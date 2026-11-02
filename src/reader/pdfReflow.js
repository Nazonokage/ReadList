// Runs inside the isolated offline reader. Text is created with textContent;
// illustrations are cropped from PDF.js's rendered page, never remote URLs.
export async function reflowPdfPage(page, canvas, OPS) {
  const text = await page.getTextContent();
  const items = text.items.filter(item => typeof item.str === 'string' && item.str.trim());
  if (!items.length) return null;
  const viewport = page.getViewport({ scale: 1 });
  const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  const lines = [];
  for (const item of items) {
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const size = Math.max(6, Math.hypot(item.transform[2], item.transform[3]));
    let line = lines.find(entry => Math.abs(entry.y-y) < Math.max(2, size*.2));
    if (!line) { line = { x, y, size, parts: [] }; lines.push(line); }
    line.x = Math.min(line.x, x);
    line.size = Math.max(line.size, size);
    line.parts.push({ x, str: item.str });
  }
  const operations = await page.getOperatorList();
  let matrix = [1,0,0,1,0,0];
  const stack = [], regions = [];
  const addRegion = (transform) => {
    const m = multiply(viewport.transform, transform);
    const points = [[m[4],m[5]],[m[0]+m[4],m[1]+m[5]],[m[2]+m[4],m[3]+m[5]],[m[0]+m[2]+m[4],m[1]+m[3]+m[5]]];
    const x = Math.max(0, Math.min(...points.map(p=>p[0]))), y = Math.max(0, Math.min(...points.map(p=>p[1])));
    const width = Math.min(viewport.width, Math.max(...points.map(p=>p[0]))) - x;
    const height = Math.min(viewport.height, Math.max(...points.map(p=>p[1]))) - y;
    if (width > 3 && height > 3 && regions.length < 200) regions.push({ x, y, width, height });
  };
  let complexGraphics = false;
  for (let i=0;i<operations.fnArray.length;i++) {
    const op=operations.fnArray[i], args=operations.argsArray[i];
    if (op===OPS.save || op===OPS.paintFormXObjectBegin) { stack.push(matrix.slice()); if(op===OPS.paintFormXObjectBegin && args[0])matrix=multiply(matrix,args[0]); }
    else if(op===OPS.restore || op===OPS.paintFormXObjectEnd) matrix=stack.pop()||[1,0,0,1,0,0];
    else if(op===OPS.transform) matrix=multiply(matrix,args);
    else if([OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject].includes(op)) addRegion(matrix);
    else if(op===OPS.paintImageXObjectRepeat) { const positions=args[3]; for(let j=0;j<positions.length;j+=2)addRegion(multiply(matrix,[args[1],0,0,args[2],positions[j],positions[j+1]])); }
    else if(op===OPS.paintInlineImageXObjectGroup) { for(const entry of args[1])addRegion(multiply(matrix,entry.transform)); }
    else if([OPS.constructPath,OPS.paintImageMaskXObjectGroup,OPS.paintImageMaskXObjectRepeat].includes(op)) complexGraphics=true;
  }
  const article=document.createElement('div');article.className='pdf-prose';
  const blocks=[...lines.map(line=>({ ...line, kind:'text' })),...regions.map(region=>({ ...region,kind:'image' }))].sort((a,b)=>a.y-b.y || a.x-b.x);
  let paragraph=null, previous=null;
  for(const block of blocks){
    if(block.kind==='text'){
      const value=block.parts.sort((a,b)=>a.x-b.x).map(part=>part.str).join(' ');
      if(!paragraph || !previous || block.y-previous.y>Math.max(block.size,previous.size)*1.8 || Math.abs(block.x-previous.x)>24){paragraph=document.createElement('p');article.appendChild(paragraph)}
      paragraph.textContent+=(paragraph.textContent?' ':'')+value;previous=block;
    }else{
      const imageCanvas=document.createElement('canvas');
      const sx=canvas.width/viewport.width, sy=canvas.height/viewport.height;
      imageCanvas.width=Math.max(1,Math.ceil(block.width*sx));imageCanvas.height=Math.max(1,Math.ceil(block.height*sy));
      imageCanvas.getContext('2d').drawImage(canvas,block.x*sx,block.y*sy,block.width*sx,block.height*sy,0,0,imageCanvas.width,imageCanvas.height);
      const image=document.createElement('img');image.alt='PDF illustration';image.src=imageCanvas.toDataURL('image/png');image.width=imageCanvas.width;image.height=imageCanvas.height;image.style.width=block.width+'px';image.style.maxWidth='100%';image.style.height='auto';
      article.appendChild(image);imageCanvas.width=0;paragraph=null;previous=null;
    }
  }
  // Keep diagrams and other vector artwork available rather than dropping them.
  if(complexGraphics){
    const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Original page with diagrams and layout';details.appendChild(summary);
    const image=document.createElement('img');image.alt='Original PDF page with graphics';image.src=canvas.toDataURL('image/png');image.width=canvas.width;image.height=canvas.height;image.style.width=viewport.width+'px';details.appendChild(image);article.appendChild(details);
  }
  return article;
}
