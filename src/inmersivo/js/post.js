/* =========================================================
   post.js — post-proceso de UNA pasada, pensado para dar NITIDEZ y brillo "Aero":
   enfoque (unsharp) en lugar de lente/píxel/scanlines, bloom suave solo en las
   luces fuertes, tono limpio y saturado, viñeta suave y un velo de luz en las
   transiciones. Nada deforma ni pixela la imagen.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.initPost = function () {
    const R = IV.R;
    const rt = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    const mat = new T.ShaderMaterial({
      uniforms: {
        t: { value: rt.texture }, time: { value: 0 }, v: { value: 0 }, tr: { value: 0 }, aero: { value: .6 },
        m: { value: new T.Vector2(.5, .5) }, res: { value: new T.Vector2(2, 2) }
      },
      vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D t;uniform float time,v,tr,aero;uniform vec2 m,res;varying vec2 u;
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec2 px=1./res,c=u-.5;
          float edge=smoothstep(.45,.95,length(c)*1.6);                 /* 0 centro · 1 bordes */
          /* aberración cromática mínima, solo en los bordes y al moverte deprisa */
          float a=(.0003+v*.0016+tr*.002)*edge;
          vec3 col=vec3(texture2D(t,u+vec2(a,0.)).r,texture2D(t,u).g,texture2D(t,u-vec2(a,0.)).b);
          /* enfoque: realza el detalle en vez de desenfocarlo */
          vec3 bl=(texture2D(t,u+vec2(px.x,0.)).rgb+texture2D(t,u-vec2(px.x,0.)).rgb+texture2D(t,u+vec2(0.,px.y)).rgb+texture2D(t,u-vec2(0.,px.y)).rgb)*.25;
          col+=(col-bl)*.65;
          /* bloom suave: solo lo muy brillante, en un anillo ancho */
          vec3 b=vec3(0.);
          for(int i=0;i<8;i++){float an=float(i)*.785398;vec2 o=vec2(cos(an),sin(an))*vec2(res.y/res.x,1.);
            b+=max(texture2D(t,u+o*.012).rgb-.82,0.)+max(texture2D(t,u+o*.03).rgb-.82,0.)*.7;}
          col+=b*(.035+aero*.05);
          /* tono Aero: más saturación y un toque de contraste limpio */
          float l=dot(col,vec3(.299,.587,.114));
          col=mix(vec3(l),col,1.10+aero*.08);
          col=(col-.5)*1.05+.5+.012;
          /* viñeta suave y grano casi imperceptible (evita bandas en degradados) */
          col*=1.-.20*dot(c,c)*1.5;
          col+=(h2(u*res+time)-.5)*.010;
          /* transiciones: velo de luz aqua que sube y baja, sin franjas ni píxeles */
          col+=vec3(.55,.9,1.)*tr*.12*(1.-edge*.6);
          gl_FragColor=vec4(col,1.);
        }`
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const qs = new T.Scene(); qs.add(quad);
    const qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    IV.post = {
      rt, mat,
      resize(w, h) { rt.setSize(w, h); mat.uniforms.res.value.set(w, h); },
      render() {
        const S = IV.S, u = mat.uniforms;
        u.time.value = S.t; u.v.value = IV.RM ? 0 : S.v; u.tr.value = IV.RM ? 0 : S.tr;
        u.aero.value = S.aero; u.m.value.set(S.sx, S.sy);
        R.setRenderTarget(rt); R.render(IV.scene, IV.cam);
        R.setRenderTarget(null); R.render(qs, qc);
      }
    };
  };
})();
