import {convertSurface} from './converter-core.js';
self.onmessage=e=>{try{postMessage({type:'complete',...convertSurface(e.data,r=>postMessage(r))})}catch(err){postMessage({type:'error',message:err.message})}};
