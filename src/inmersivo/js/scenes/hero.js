/* =========================================================
   scenes/hero.js — retrato ASCII que reacciona al ratón.
   Es un shader: cada celda elige un glifo según su brillo.
   Sin vídeo dibuja una figura procedural (auriculares + visor);
   con CONFIG.heroVideo usa la luminancia del vídeo.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.build.push(['Hero · retrato ASCII', () => {
    const S = IV.S, P = IV.P;
    const group = new T.Group(); IV.scene.add(group);

    /* atlas de glifos ordenados de menos a más "tinta" */
    const chars = ' .:-+oxX#@', cw = 32, ch = 64;
    const atlas = IV.canvasTex(cw * chars.length, ch, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = '400 56px ' + IV.F.mono; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...chars].forEach((s, i) => g.fillText(s, i * cw + cw / 2, h / 2 + 3));
    });
    atlas.generateMipmaps = false; atlas.minFilter = atlas.magFilter = T.LinearFilter;

    /* vídeo opcional */
    let vidTex = new T.Texture(), video = null;
    if (IV.CONFIG.heroVideo) {
      video = document.createElement('video');
      video.src = IV.CONFIG.heroVideo; video.loop = video.muted = video.playsInline = true; video.crossOrigin = 'anonymous';
      video.play().catch(() => {});
      vidTex = new T.VideoTexture(video);
    }

    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        t: { value: 0 }, uFade: { value: 1 }, uAsp: { value: 1.78 }, uCols: { value: IV.LOW ? 80 : 150 }, uHasVid: { value: video ? 1 : 0 },
        m: { value: new T.Vector2(.5, .5) }, uAtlas: { value: atlas }, uVid: { value: vidTex }
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        varying vec2 vUv;uniform float t,uFade,uAsp,uCols,uHasVid;uniform vec2 m;uniform sampler2D uAtlas,uVid;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float sdE(vec2 p,vec2 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/k1;}
        float sdB(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
        float smin(float a,float b,float k){float x=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,x)-k*x*(1.-x);}
        /* figura: cabeza + cuello + hombros, con auriculares */
        float fig(vec2 p){
          float head=sdE(p-vec2(0.,.10),vec2(.150,.205));
          float neck=sdB(p-vec2(0.,-.10),vec2(.062,.10));
          float sh=sdE(p-vec2(0.,-.37),vec2(.40,.165));
          float cup=min(sdE(p-vec2(-.165,.10),vec2(.040,.075)),sdE(p-vec2(.165,.10),vec2(.040,.075)));
          float d=smin(smin(head,neck,.05),sh,.07);
          return min(d,cup);
        }
        void main(){
          vec2 cell=vec2(1./uCols, uAsp*2.1/uCols);          /* celda en uv (glifo ~1:2) */
          vec2 id=floor(vUv/cell);vec2 cuv=(id+.5)*cell;
          vec2 lp=fract(vUv/cell);
          vec2 p=(cuv-.5)*vec2(uAsp,1.);
          vec2 mp=(m-.5)*vec2(uAsp,1.);
          p.x-=.17*step(1.25,uAsp);                          /* figura a la derecha en pantallas anchas */
          mp.x-=.17*step(1.25,uAsp);
          /* ondas del ratón sobre la figura */
          vec2 dm=p-mp;float rm=length(dm);
          p+=normalize(dm+1e-4)*.012*smoothstep(.3,0.,rm)*sin(rm*46.-t*6.);

          float b=0.;
          float d=fig(p);
          float inside=step(d,0.);
          if(uHasVid>.5){
            vec3 vc=texture2D(uVid,vec2(cuv.x,cuv.y)).rgb;b=dot(vc,vec3(.3,.59,.11));
          }else{
            /* normal pseudo-3D por gradiente del SDF */
            vec2 e=vec2(.004,0.);
            vec2 gr=normalize(vec2(fig(p+e.xy)-fig(p-e.xy),fig(p+e.yx)-fig(p-e.yx))+1e-5);
            float z=clamp(-d*9.,0.,1.);
            vec3 n=normalize(vec3(gr*(1.-z*.8),.25+z));
            vec3 L=normalize(vec3(mp-p,.45));
            float dif=max(dot(n,L),0.);
            float fill=.16+.7*dif;
            /* visor: banda oscura con línea de datos */
            float vis=step(abs(p.y-.115),.034)*step(abs(p.x),.15);
            float scan=.45+.55*step(.5,fract(p.x*30.-t*1.5));
            fill=mix(fill,.1+.55*scan*vis,vis*.9);
            /* contorno brillante */
            float edge=smoothstep(.013,0.,abs(d));
            b=inside*fill+edge*.95;
          }
          /* fondo: lluvia de glifos + halo Aero */
          float col=id.x,row=id.y;
          float sp=.12+.35*h(vec2(col,3.));
          float rain=fract(h(vec2(col,0.))*9.-t*sp+row/ (uCols/uAsp*.5));
          float bg=pow(rain,9.)*.55*(1.-inside);
          float halo=smoothstep(.62,0.,length(p-vec2(0.,.1)))*.22;
          b=max(b,bg+halo*(1.-inside)*step(.4,h(id)));
          /* el ratón enciende y revuelve glifos */
          float lit=smoothstep(.22,0.,rm);
          float jit=step(.55,h(id+floor(t*7.)));
          b+=lit*.55*jit;
          b=clamp(b+(h(id+floor(t*3.))-.5)*.12*step(.05,b),0.,1.);
          float gi=floor(b*9.+.5);
          float gl=texture2D(uAtlas,vec2((gi+lp.x)/10.,lp.y)).r;
          /* rejilla curva de fondo (guiño al CRT) */
          vec2 q=vUv-.5;float curve=1.+.28*q.y*q.y;
          float gx=smoothstep(.012,0.,abs(fract(q.x*curve*14.)-.5)-.488);
          float gy=smoothstep(.012,0.,abs(fract(q.y*9.)-.5)-.488);
          float grid=max(gx,gy)*.16;
          vec3 mint=vec3(.50,1.,.83),aq=vec3(.21,.83,1.),lime=vec3(.55,1.,.31);
          vec3 tint=mix(mint,aq,smoothstep(.2,.9,vUv.y));
          tint=mix(tint,lime,lit*.6);
          vec3 c=tint*gl*(.35+b*1.1)+aq*grid*(1.-gl);
          gl_FragColor=vec4(c,uFade);
        }`
    });
    const plane = new T.Mesh(new T.PlaneGeometry(1, 1), mat); plane.renderOrder = 20; group.add(plane);   // se dibuja la última: tapa el mundo de detrás mientras es visible

    /* burbujas Aero delante del retrato */
    const bub = IV.makeBubbles(IV.LOW ? 18 : 42, { x: 0, y: 0, z: 5, w: 22, h: 12, d: 5 }, .26, 0x7fe9ff);
    group.add(bub.mesh);

    function fit() {
      const cam = IV.cam, hv = 2 * 12 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      plane.scale.set(hv * cam.aspect * 1.04, hv * 1.04, 1); mat.uniforms.uAsp.value = cam.aspect;
    }
    const prev = IV.onResize; IV.onResize = (w, h) => { prev && prev(w, h); fit(); };
    fit();

    IV.scenes.hero = {
      group, range: [0, P.roster + .01],
      update() {
        const u = mat.uniforms;
        u.t.value = S.t; u.m.value.set(S.sx, S.sy);
        /* se desvanece al acercarse la cámara ("salir hacia fuera") */
        u.uFade.value = IV.ss(.5, 7, IV.cam.position.z);
        bub.update(S.t);
      }
    };
    IV.sceneList.push(IV.scenes.hero);
  }]);
})();
