varying float vColorMix;
varying vec2 vUV;
uniform sampler2D uTexture;

varying vec3 xNormal;
varying vec3 vPosition;
uniform vec3 sunDir;
uniform vec3 atmoshpereDay;
uniform vec3 atmoshpereTwilight;

uniform bool uShowPureColor;

void main() {
    // 单位化
    vec3 fnormal = normalize(xNormal);

    vec4 tColor = texture2D(uTexture, vUV);

    vec3 color = vec3(0., 0., 1.);

    float mix1 = smoothstep(0.001, 0.1, vColorMix);
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
    if(uShowPureColor == false) {
        color = tColor.rgb;
    }

    // vec3 night = color * 0.002;
    vec3 night = color * 0.2;

    float sunOrientation = dot(sunDir, fnormal);
    float dayMix = smoothstep(-0.25, 0.5, sunOrientation);

    // 纠正方向
    color = mix(night, color, dayMix);

    // fresnel 菲涅尔，贴近地面时具有更好的发光效果
    // vec3 viewDirection = normalize(vPosition - cameraPosition);
    // float fresnel = dot(viewDirection, fnormal) + 1.0;
    // fresnel = pow(fresnel, 2.0);
    // // fresnel = pow(fresnel, 10.0);
    // // atomoshpere
    // float atMix = smoothstep(-0.5, 1.0, sunOrientation);
    // vec3 aColor = mix(atmoshpereTwilight, atmoshpereDay, atMix);
    // color = mix(color, aColor, fresnel * atMix);

    // csm_DiffuseColor = vec4(vUV.xy, 1.0, 1.0);
    csm_DiffuseColor = vec4(color, 1.0);

    // csm_DiffuseColor = vec4(tColor.rgb, 1.0);
}