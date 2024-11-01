void main() {
    varying float vElevation;

    vec3 color = vec3(0.0);
    float colorMix = smoothstep(0.0, 0.5, vElevation);

    color = mix(color, vec3(0.0, 1.0, 0.0), colorMix);

    float colorMix1 = step(0.5, vElevation);
    
    color = mix(color, vec3(1.0, 1.0, 1.0), colorMix1);

    csm_DiffuseColor = vec4(color, 1.0);
}