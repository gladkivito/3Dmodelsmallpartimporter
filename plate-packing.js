// Pick a filled rectangle of compatible surface cells under the SmallPart size cap.
// Looking down several rows avoids committing to a long, one-row strip first.
export function choosePlateRectangle(x,y,width,height,cell,along,shear,across,find){
 const maxRows=Math.max(1,Math.min(height-y,Math.floor(2.49/(cell*across))));
 const maxCols=Math.max(1,Math.min(width-x,Math.floor((2.49/cell-shear)/along)));
 let shortest=maxCols,bestW=1,bestH=1,bestArea=0;
 for(let h=1;h<=maxRows;h++){
  let rowWidth=0;for(;rowWidth<shortest&&rowWidth<maxCols&&find(x+rowWidth,y+h-1);rowWidth++);
  shortest=Math.min(shortest,rowWidth);if(shortest===0)break;
  const allowed=Math.max(1,Math.floor((2.49/cell-h*shear)/along));
  const w=Math.min(shortest,allowed),area=w*h;
  if(area>bestArea||(area===bestArea&&w>bestW)){bestArea=area;bestW=w;bestH=h}
 }
 return[bestW,bestH];
}
