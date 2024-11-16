varying vec3 vvNormal;
varying vec3 vPosition;

uniform vec3 uSunDir;
uniform vec3 uAtmDay;
uniform vec3 uAtmTwilight;

void main() {
    // 注意单位化
    vec3 nNormal = normalize(vvNormal);
    vec3 color = vec3(0.);

    // -1 ~ 1
    float sunOrientation = dot(uSunDir, nNormal);

    vec3 viewDirection = normalize(vPosition - cameraPosition);

    // fresnel 菲涅尔，贴近地面时具有更好的发光效果
    // float fresnel = dot(viewDirection, nNormal) + 1.0;
    // fresnel = pow(fresnel, 2.0);

    // atmosphere
    float atmMix = smoothstep(-0.5, 1.0, sunOrientation);
    vec3 aColor = mix(uAtmTwilight, uAtmDay, atmMix);
    // color = mix(color, aColor, fresnel * atMix);
    color += aColor;

    // specular
    // vec3 reflection = reflect(-uSunDir, nNormal);
    // float specular1 = -dot(reflection, viewDirection);
    // specular1 = max(specular1, 0.);
    // specular1 = pow(specular1, 32.);
    // vec3 specularColor1 = mix(vec3(1.0), aColor, fresnel);
    // color += specular * specularColor1;

    // 增加大气层透明度alpha
    float alpha = dot(viewDirection, nNormal);
    alpha = smoothstep(0.0, 0.5, alpha);

    float dayAlpha = smoothstep(-0.5, 0.0, sunOrientation);

    float finalAlpha = alpha * dayAlpha;

    csm_DiffuseColor = vec4(color, finalAlpha);
}