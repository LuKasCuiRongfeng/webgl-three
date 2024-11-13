varying vec3 xNormal;
varying vec3 vPosition;
uniform vec3 uSunDir;
uniform vec3 uAtmDay;
uniform vec3 uAtmTwilight;

void main() {
    vec3 fnormal = normalize(xNormal);
    vec3 color = vec3(0.);
    // -1 ~1 方向反了
    float sunOrientation = dot(uSunDir, fnormal);

    // fresnel 菲涅尔
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    // float fresnel = dot(viewDirection, fnormal) + 1.0;
    // fresnel = pow(fresnel, 2.0);

    // atomoshpere
    float atMix = smoothstep(-0.5, 1.0, sunOrientation);
    vec3 aColor = mix(uAtmTwilight, uAtmDay, atMix);
    // color = mix(color, aColor, fresnel * atMix);
    color += aColor;

    // alpha
    float alpha = dot(viewDirection, fnormal);
    alpha = smoothstep(0.0, 0.5, alpha);

    float dayAlpha = smoothstep(-0.5, 0.0, sunOrientation);

    float finalAlpha = alpha * dayAlpha;

    csm_DiffuseColor = vec4(color, finalAlpha);
}