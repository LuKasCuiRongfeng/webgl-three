varying float vColorMix;
varying vec2 vUV;
varying vec3 vHoverTileColor;
varying vec3 xNormal;
varying vec3 vPosition;

uniform vec3 uSunDir;
uniform vec3 uAtmDay;
uniform vec3 uAtmTwilight;
uniform sampler2D uTexture;
uniform bool uPureColor;

void main() {
    // 单位化插值过的法向量
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
    if(uPureColor == false) {
        color = tColor.rgb;
    }

    // 悬浮色
    color = color * vHoverTileColor;

    // vec3 night = color * 0.002;
    // vec3 night = color * 0.2;

    // float sunOrientation = dot(uSunDir, fnormal);
    // float dayMix = smoothstep(-0.25, 0.5, sunOrientation);

    // // 昼夜更替效果
    // color = mix(night, color, dayMix);

    // fresnel 菲涅尔，贴近地面时具有更好的发光效果
    // vec3 viewDirection = normalize(vPosition - cameraPosition);
    // float fresnel = dot(viewDirection, fnormal) + 1.0;
    // fresnel = pow(fresnel, 2.0);
    // // fresnel = pow(fresnel, 10.0);
    // // atomoshpere
    // float atMix = smoothstep(-0.5, 1.0, sunOrientation);
    // vec3 aColor = mix(uAtmTwilight, uAtmDay, atMix);
    // color = mix(color, aColor, fresnel * atMix);

    // specular
    // vec3 reflection = reflect(-uSunDir, fnormal);
    // float specular1 = -dot(reflection, viewDirection);
    // specular1 = max(specular1, 0.);
    // specular1 = pow(specular1, 32.);

    // vec3 specularColor1 = mix(vec3(1.0), aColor, fresnel);

    // color += specular * specularColor1;

    // csm_DiffuseColor = vec4(vUV.xy, 1.0, 1.0);
    csm_DiffuseColor = vec4(color, 1.0);

    // csm_DiffuseColor = vec4(tColor.rgb, 1.0);
}