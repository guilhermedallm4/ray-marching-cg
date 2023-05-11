"use strict";
const vs = `#version 300 es
  // an attribute is an input (in) to a vertex shader.
  // It will receive data from a buffer
  in vec4 a_position;

  // all shaders have a main function
  void main() {

    // gl_Position is a special variable a vertex shader
    // is responsible for setting
    gl_Position = a_position;
  }
`;

const fs = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iTime;

// we need to declare an output for the fragment shader
out vec4 outColor;


#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURFACE_DIST .01




mat2 Rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);

    /*
retorna uma matriz 2x2 que representa uma rotação 2D no sentido 
anti-horário por um ângulo a especificado em radianos. 
A rotação é aplicada em torno da origem (0, 0). 
*/
}


vec3 R(vec2 uv, vec3 p, vec3 l, float z) {
    vec3 f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = p+f*z,
        i = c + uv.x*r + uv.y*u,
        d = normalize(i-p);
    return d;

    /*
passa por uma determinada coordenada na tela definida pelos valores de uv.
Essa função é usada para calcular o raio de visão em um sistema de renderização
em tempo real.*/
}

float dBox(vec3 p, vec3 s){
        return length(max(abs(p)-s, 0.));
}

float sdBoxFrame( vec3 p, vec3 b, float e )
{
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e; 
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}
//Pega distancia da esféra em relação a câmera

float smin(float a, float b, float k){
	float h = clamp(0.5+0.5*(b-a)/k, 0., 1.);
	return mix(b, a, h) - k*h*(1.0-h);
  /*
  calcular a distância assinada entre duas formas geométricas usando a operação de 
  suavização de mínimo. Essa operação é usada para combinar as duas formas em uma 
  única forma suavizada, onde a transição entre as formas é gradual em vez de abrupta.
  */
}


float GetDist(vec3 p){
    float t = iTime;
	float planeDist = p.y;
    
    vec3 bp = p;
    bp -= vec3(-1, 2,1); // translação 
    bp.xz *= Rot(iTime); // Rtação
    bp.yz*= Rot(iTime);  // Rotação
       
    float bd = dBox(bp, vec3(.75));
    float sdA = length(p-vec3(-1,2,0.9))-1.;
    //Operação de subtração em duas formas diferentes e posteriormente unificação das mesmas.
    //Operaão de Subtração max(-a, b)
    //Operação de Intersecção max(a,b)
    //Operação de União min(a,b)
    
    float sd = mix(bd, sdA, sin(iTime)*.5+.5);
    
   
    float box = sdBoxFrame( p-vec3(-1,2,0.5), vec3(5, 5.4, 3), 0.1)/.4;
    float box_two = sdBoxFrame( p-vec3(-.5,1,0.8), vec3(2, 3, 3.3), 0.1)/.2;
    float box_three = sdBoxFrame( p-vec3(-.3,3,0.2), vec3(1, 6, 3), 0.1)/.7;
    float box_four = sdBoxFrame( p-vec3(-3,1,3), vec3(4, 4.5, 3), 0.1)/.5;
    /*
    dividido por 0,5 para normalizá-lo para o intervalo [-1, 1]. Este valor normalizado é 
    usado posteriormente para gerar a cor da superfície na posição "p" usando técnicas de ray marching.
    */

    float d = min(sd, planeDist);
    d = min(d, box);
    d = min(d, box_two);
    d = min(d, box_three);
    d = min(d, box_four);
    

    return d;
    /*
Esta é uma função usada em um shader de ray marching para calcular a
distância da posição "p" até o objeto mais próximo na cena.
*/
}



//Executa o Ray-Marching e calcula o ponto que foi interceptado
float RayMarch(vec3 ro, vec3 rd){
    float dO = 0.;
    for(int i=0; i<MAX_STEPS;i++){
        vec3 p = ro+dO*rd;
        float dS = GetDist(p);
        dO += dS;
        if(dS<SURFACE_DIST || dO>MAX_DIST) break;
    }
    return dO;
}

//Cálcula o valor do vetor normal para iluminação
/*
light = dot(LightVector, NormalVector)

LightVector = normalize(LightPos-SurfacePos)

NormalVector = GetNormal(p)

*/
vec3 GetNormal(vec3 p){
	vec2 e = vec2(.03, 0);
	float d = GetDist(p);
	vec3 n = vec3(
		d-GetDist(p-e.xyy),
		d-GetDist(p-e.yxy),
		d-GetDist(p-e.yyx)
	);

	return normalize(n);


//função para calcular a normal de uma superfície em um ponto específico "p".
/*Ela utiliza um método conhecido como "diferença finita" para aproximar a derivada da função de distância (GetDist) 
em três direções diferentes. A ideia é deslocar o ponto "p" ligeiramente em cada direção e calcular a diferença de distância 
entre o ponto original e o ponto deslocado. A normal é então calculada a partir dessas diferenças de distância, 
usando-as como componentes do vetor normal.*/

}

float GetLight(vec3 p) {
    vec3 lightPos = vec3(3, 5, 4);
    vec3 l = normalize(lightPos-p);
    vec3 n = GetNormal(p);
    
    float dif = clamp(dot(n, l)*.5+.5, 0., 1.);
    float d = RayMarch(p+n*SURFACE_DIST*2., l);
    if(p.y<.01 && d<length(lightPos-p)) dif *= .5;
    
    return dif;
    /*
Essa função é usada para calcular a intensidade da luz em um ponto específico "p" 
em um shader de ray marching.
*/
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // ro = posição da câmera
    // rd = direção do raio
    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
	  vec2 m = iMouse.xy/iResolution.xy;
    
    vec3 col = vec3(0);
    
    vec3 ro = vec3(-1, 4, 4);
    ro.yz *= Rot(-m.y+.6);
    ro.xz *= Rot(iTime*.4);
    
    vec3 rd = R(uv, ro, vec3(0,1.5,0), .7);

    float d = RayMarch(ro, rd);
    
    if(d<MAX_DIST) {
    	vec3 p = ro + rd * d;
    
    	float dif = GetLight(p);
    	col = vec3(dif);
    }
    col = pow(col, vec3(1, .54,23));
    //col = pow(col, vec3(.4545));	
    
    fragColor = vec4(col,1.0);
}
void main() {
  mainImage(outColor, gl_FragCoord.xy);
}
`;

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }


  // setup GLSL program
  const program = webglUtils.createProgramFromSources(gl, [vs, fs]);

  // look up where the vertex data needs to go.
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  // look up uniform locations
  const resolutionLocation = gl.getUniformLocation(program, "iResolution");
  const mouseLocation = gl.getUniformLocation(program, "iMouse");
  const timeLocation = gl.getUniformLocation(program, "iTime");

  // Create a vertex array object (attribute state)
  const vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  // Create a buffer to put three 2d clip space points in
  const positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // fill it with a 2 triangles that cover clip space
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  // first triangle
     1, -1,
    -1,  1,
    -1,  1,  // second triangle
     1, -1,
     1,  1,
  ]), gl.STATIC_DRAW);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  gl.vertexAttribPointer(
      positionAttributeLocation,
      2,          // 2 components per iteration
      gl.FLOAT,   // the data is 32bit floats
      false,      // don't normalize the data
      0,          // 0 = move forward size * sizeof(type) each iteration to get the next position
      0,          // start at the beginning of the buffer
  );

  const playpauseElem = document.querySelector('.playpause');
  const inputElem = document.querySelector('.divcanvas');
  inputElem.addEventListener('mouseover', requestFrame);
  //inputElem.addEventListener('mouseout', cancelFrame);

  let mouseX = 0;
  let mouseY = 0;

  function setMousePosition(e) {
    const rect = inputElem.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = rect.height - (e.clientY - rect.top) - 1;  // bottom is 0 in WebGL
  }

  inputElem.addEventListener('mousemove', setMousePosition);
  inputElem.addEventListener('touchstart', (e) => {
    e.preventDefault();
    playpauseElem.classList.add('playpausehide');
    requestFrame();
  }, {passive: false});
  inputElem.addEventListener('touchmove', (e) => {
    e.preventDefault();
    setMousePosition(e.touches[0]);
  }, {passive: false});
  inputElem.addEventListener('touchend', (e) => {
    e.preventDefault();
    playpauseElem.classList.remove('playpausehide');
    cancelFrame();
  }, {passive: false});

  let requestId;
  function requestFrame() {
    if (!requestId) {
      requestId = requestAnimationFrame(render);
    }
  }
  function cancelFrame() {
    if (requestId) {
      cancelAnimationFrame(requestId);
      requestId = undefined;
    }
  }

  let then = 0;
  let time = 0;
  function render(now) {
    requestId = undefined;
    now *= 0.001;  // convert to seconds
    const elapsedTime = Math.min(now - then, 0.1);
    time += elapsedTime;
    then = now;

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(vao);

    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(mouseLocation, mouseX, mouseY);
    gl.uniform1f(timeLocation, time);

    gl.drawArrays(
        gl.TRIANGLES,
        0,     // offset
        6,     // num vertices to process
    );

    requestFrame();
  }

  requestFrame();
  requestAnimationFrame(cancelFrame);
}

main();
