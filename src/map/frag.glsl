varying float vColorMix;
varying vec2 vUV;
uniform sampler2D uTexture;

void main() {
    vec4 tColor = texture2D(uTexture, vUV);

    vec3 color = vec3(0., 0., 1.);

    float mix1 = smoothstep(-2.0, 0.1, vColorMix);
    color = mix(color, vec3(0., 1., 0.), mix1);

    float mix0 = step(2.1, vColorMix);
    color = mix(color, vec3(0., 1.0, 0.5), mix0);

    float mix2 = step(6.1, vColorMix);
    color = mix(color, vec3(1., 1., 0.), mix2);

    float mix3 = step(12.1, vColorMix);
    color = mix(color, vec3(0.9), mix3);

    float mix4 = step(18.1, vColorMix);
    color = mix(color, vec3(1.0), mix4);

    // 混合纹理的颜色
    // color = color * tColor.rgb;
    color = tColor.rgb;

    // csm_DiffuseColor = vec4(vUV.xy, 1.0, 1.0);
    csm_DiffuseColor = vec4(color, 1.0);

    // csm_DiffuseColor = vec4(tColor.rgb, 1.0);
}