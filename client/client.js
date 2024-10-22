import io from 'socket.io-client'
import  EventEmitter  from "events";
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

const utils = {
  throttle :  function (cb, delay = 1000){
    let shouldWait = false;
    let waitingArgs;
    const timeoutFunc = () => {
      if (waitingArgs == null) {
        shouldWait = false;
      } else {
        cb(...waitingArgs);
        waitingArgs = null;
        setTimeout(timeoutFunc, delay);
      }}
  
    return (...args) => {
      if (shouldWait) {
        waitingArgs = args;
        return;
      }
  
      cb(...args);
      shouldWait = true;
  
      setTimeout(timeoutFunc, delay);
    }},
  debounce:function (func, timeout = 300){
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }
}


const applicationParameters = {
  width: 1000,
  height: 1000,
  pallete: [
    0xFFF2F4F5, 0xFF1A1B1C ,  0xFF425430,  0xFF74ED6F,  0xFFC4B02D,  0xFFA63417,  0xFF4A1538,  0xFF631482,    0xFFA727D9,    0xFF133766, 0xFF2F95FA   , 0xFF747678,   0xFF2032BD,  0xFF0E1CE8,    0xFF24FFFB,    0xFF009BA3
  ],
  palleteHex: [`#f5f4f2`, `#1c1b1a`,`#305442`, `#6fed74`,`#2db0c4`, `#1734a6`,`#38154a`, `#821463`,`#d927a7`, `#663713`,`#fa952f`, `#787674`,`#bd3220`, `#e81c0e`,`#fbff24`, `#a39b00`],
  timerTimeStep:1000,
  minScaleReticle:8,
  zoom:{
    min: 0.3,
    max: 32,
    delta: 2,
    scrollDistance: 500,
    alpha: false,
    zoomLevels :[0.5,1,2,20]}
};
async function inputManager(canvasManagerInstance,requestManagerInstance){
  let state = canvasManagerInstance.state
  let reticle = canvasManagerInstance.reticle
  const colorDivs = document.getElementsByClassName('color')
  const timeDiv = document.getElementById('timer')
  const selectButton = document.getElementById('select')
  const signatureElement = document.getElementById('signature-input')
  const cancelButton = document.getElementById('cancel')
  let reticleState = canvasManagerInstance.reticleState
  let active
  function updateTimer(duration=20000) {
    let id
    var timer = duration, minutes, seconds,miliseconds;
    id = setInterval(function () {
        miliseconds = parseInt(timer%1000)
        seconds = Math.floor(timer / 1000)
        minutes = Math.floor(seconds/60)
        seconds = seconds%60
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        miliseconds = miliseconds <10 ? '0' + miliseconds : miliseconds;
        timeDiv.textContent = minutes + ":" + seconds;
        timer -= applicationParameters.timerTimeStep
        if (--timer < 0) {
            timeDiv.textContent=``
            clearInterval(id)
        }
    }, applicationParameters.timerTimeStep);
}

  function updatePixel(username, tileDetails){
    if (reticleState.x<0 || reticleState.y <0){return}
    requestManagerInstance.updatePixel(username,tileDetails)
    updateTimer()
  }

  function generateUniqueNameWithNumber() {
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    const uniqueName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals], 
      separator: '-',  
      length: 3        
    });
    return `${uniqueName}-${randomNumber}`;
  }
  async function fetchUsername(){
    const key = 'username'
    let value =  localStorage.getItem(key)
    if (value){
    }
    else{
      value = generateUniqueNameWithNumber()
    }
    signatureElement.value = value
    signatureElement.classList.toggle(`valid`)
    user = value
  }
  function loadColors(){
    Array.from(colorDivs).forEach((element,index)=>{
      element.style.background = `${applicationParameters.palleteHex[index-1]}`
      element.addEventListener('click',(e)=>{
        e.stopPropagation()
        let clickedDiv = e.target
        if (active){
          active.classList.remove('active')
        }
        clickedDiv.classList.add('active')
        active = clickedDiv
        let idx = parseInt(active.getAttribute('index'),10)
        reticle.style.backgroundColor = applicationParameters.palleteHex[idx]
        state.active = idx
      })
    } )
  }
  cancelButton.addEventListener('click',()=>{
    reticleState.x = -1
    reticleState.y = -1
    reticle.style.display = `None`
    if (active){
      active.classList.remove('active')
    }

  })
  selectButton.addEventListener('click', ()=>
    {
      let tileDetails = {
        'x':reticleState.x, 
        'y':reticleState.y,
        'offset':reticleState.x + applicationParameters.width* reticleState.y,
        'color': state.active
      }
      const key = 'username'
      localStorage.setItem(key,user)
      updatePixel(user,tileDetails)})
  loadColors()
  fetchUsername()
  let duration = await myRequestManager.getUserDetails(user)
  // updateTimer(parseInt(duration))
}

function zoomManager(canvasManagerInstance){
  let state = canvasManagerInstance.state
  let canvasContainer = canvasManagerInstance.canvasContainer
  let reticle = canvasManagerInstance.reticle
  let reticleState = canvasManagerInstance.reticleState
  const zoomHandler = (e)=>{
      const bcrCvs = canvasContainer.getBoundingClientRect();
      let scaleOld =state.scale
      const distLeft = (e.x - bcrCvs.left)
      const distTop = (e.y-bcrCvs.top)
      const yOrg = Math.floor(distTop / scaleOld)
      const xOrg = Math.floor(distLeft/scaleOld)
      let xDist = e.x-xOrg-state.ogBcr.left
      let yDist = e.y - yOrg - state.ogBcr.top

      if (e.deltaY< 0){
        state.currentZoomLevel+=1
      }
      else {
        state.currentZoomLevel -= 1
      }
      state.currentZoomLevel = Math.max(0, Math.min(applicationParameters.zoom.zoomLevels.length-1,state.currentZoomLevel))
      state.scale = applicationParameters.zoom.zoomLevels[state.currentZoomLevel]
      if (state.scale == scaleOld)return

      canvasContainer.style.transformOrigin = `${xOrg}px ${yOrg}px`
      // canvasContainer.style.translate = `${xDist}px, ${yDist}px`;
      canvasContainer.style.transform = `translate(${xDist}px, ${yDist}px) scale(${state.scale},${state.scale})`
      state.totalDelX = xDist
      state.totalDelY = yDist
      if (state.scale<applicationParameters.minScaleReticle){
        reticle.style.display = `None`
        reticleState.x = -1
        reticleState.y = -1
        return
      }
      reticle.style.width = `${state.scale}px`
      reticle.style.height = `${state.scale}px`

    }
    const debounceZoomHandler = utils.debounce((e) => {
      zoomHandler(e);
    },100);

    canvasContainer.addEventListener('wheel',debounceZoomHandler)
  }

function panManager(canvasManagerInstance){
  let state = canvasManagerInstance.state
  let canvasContainer = canvasManagerInstance.canvasContainer
  let [startPanX,startPanY] = [null,null]
  let isPanning = 0
  let ccBcr = canvasContainer.getBoundingClientRect()
  let [cxl,cxt,cw,ch] = [ccBcr.left, ccBcr.top,ccBcr.width,ccBcr.height]
  function mouseDownHandler(e) {
    isPanning = 1;
    [startPanX, startPanY] = [e.clientX, e.clientY];
    canvas.addEventListener("mousemove", throttleDragHandler);
  }
  function mouseUpHandler(e) {
    isPanning = 0;
    [startPanX, startPanY] = [null, null];
    canvas.removeEventListener("mousemove", throttleDragHandler);
  }
  function dragHandler (e){
    let [delX, delY] = [0,0];
    if (
      (cxl <= e.clientX <= cxl + cw &&
        cxt <= e.clientY <= cxt + ch) == false
    ) {
      isPanning = 0;
      return
    }
    if (isPanning === 0) {
      return;
    }
    delX = e.clientX - startPanX;
    delY = e.clientY - startPanY;

    [startPanX, startPanY] = [e.clientX, e.clientY];
    [state.totalDelX, state.totalDelY] = [state.totalDelX + delX, state.totalDelY + delY];
    canvasContainer.style.transform = `translate(${state.totalDelX}px, ${state.totalDelY}px) scale(${state.scale},${state.scale})`;
  }
  const throttleDragHandler = utils.throttle((e) => {
    dragHandler(e);
  },30);
  body.addEventListener('mousedown',mouseDownHandler)
  body.addEventListener('mouseup',mouseUpHandler)

}

function canvasManager(eventEmitterInstance, requestManagerInstance) {
  const canvasContainer = document.getElementById('canvas-container')
  const canvas = document.getElementById("canvas");
  const reticle = document.getElementById('reticle')
  const reticleState = {'x':-1,'y':-1}
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // const ogBcr = canvasContainer.getBoundingClientRect();
  const state = {'ogBcr':canvasContainer.getBoundingClientRect(),
  'totalDelX':0,'totalDelY':0,'scale':1,'currentZoomLevel':0,'activeColor':null
  }
  ctx.imageSmoothingEnabled = true;
  let imageData = ctx.createImageData(applicationParameters.width, applicationParameters.height);
  let pixelBuffer8 = new Uint8ClampedArray(imageData.data.buffer);
  let pixelBuffer32 = new Uint32Array(imageData.data.buffer);
  const applyUpdates = (update) => {
      const { x, y, offset, color } = update;
      // const offset = x + applicationParameters.width * y;
      pixelBuffer32[offset] = applicationParameters.pallete[color];
  };
  const placeReticle = (e)=>{
      if (state.scale<applicationParameters.minScaleReticle){return}

      const bcrCvs = canvasContainer.getBoundingClientRect();
      const distLeft = (e.x - bcrCvs.left)
      const distTop = (e.y-bcrCvs.top)
      const yOrg = Math.floor(distTop / state.scale)
      const xOrg = Math.floor(distLeft/state.scale)
      let x = bcrCvs.left+xOrg*state.scale
      let y = bcrCvs.top+yOrg*state.scale
      // let x = xOrg*state.scale
      // let y = yOrg*state.scale
      reticle.style.display = `block`
      reticle.style.left = `${x}px`
      reticle.style.top = `${y}px`
      reticle.style.width = `${state.scale}px`
      reticle.style.height = `${state.scale}px`
      reticle.style.backgroundColor = applicationParameters.palleteHex[state.active]
      reticleState.x = xOrg
      reticleState.y = yOrg
      // reticle.style.transform = canvasContainer.style.transform

  }
  const loadData = (data)=>{
    for ( let i=0;i<data.length;i++ ){
      pixelBuffer32[i*2] = applicationParameters.pallete[(data[i]&0xf0)>>4]
      pixelBuffer32[i*2+1] = applicationParameters.pallete[data[i]&0xf]
      
    }

    // ctx.putImageData(data,0,0)
  }
  const renderFrame = () => {
      imageData = new ImageData(pixelBuffer8,1000,1000)
      // ctx.scale(scale,scale)
      ctx.putImageData(imageData, 0, 0);  

    requestAnimationFrame(renderFrame);
  };

  
  const start = ()=>{
    requestAnimationFrame(renderFrame);
  } 
  eventEmitterInstance.on('update-pixel', applyUpdates)
  eventEmitterInstance.on('initial-data',loadData)
  canvasContainer.addEventListener('click',placeReticle)

  return { applyUpdates,start,state,canvasContainer,reticle,reticleState}

  
}

function socketManager(eventEmitterInstance) {
  const socket = io();
  socket.on('pixel-update', (update) => {
    eventEmitterInstance.emit('update-pixel',update);
  });

}
function requestsManager(eventEmitterInstance){
  
  const requestFullBoard = async ()=>{
    let canvasBuffer = await fetch ('/get-canvas')
    canvasBuffer = await canvasBuffer.arrayBuffer()
    const view = new Uint8ClampedArray(canvasBuffer)
    eventEmitterInstance.emit('initial-data',view)
  }
  const getUserDetails = async(user)=>{
    if (user){
    let userDetails = await fetch (`/get-user-data?userName=${user}`)
    userDetails = await (userDetails.text())
    return userDetails
    //  = JSON.parse(userDetails)
    // if (userDetails.timeStamp){
    //   differenceMs = Date.now()-userDetails.timeStamp;
    //   // const differenceSeconds = Math.floor(differenceMs / 1000);
    // }
    // const timeLeft = 5000-Math.max(0,differenceMs)
  }
  }
  const updatePixel = async(userName,tileDetails)=>{
    try {

      const response = await fetch(`/place-tile`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({userName,tileDetails}) // body data type must match "Content-Type" header
      })
    } catch (error) {
      console.log(error)
    }
    
  }

  requestFullBoard()
  // updatePixel('meaow',{
  //   x:2,
  //   y:0,
  //   offset:2,
  //   color:2
  // })
  return {updatePixel, getUserDetails}
}

// Initialize canvasManager and socketManager
const body = document.getElementsByTagName('body')[0]
const myEventEmitter = new EventEmitter()
const mySocketManager = socketManager(myEventEmitter);
const myRequestManager = requestsManager(myEventEmitter)
const myCanvasManager = canvasManager(myEventEmitter,myRequestManager);
let user =``
myCanvasManager.start();


const myZoomManager = zoomManager(myCanvasManager)
const myPanManager = panManager(myCanvasManager)
inputManager(myCanvasManager,myRequestManager)