precision highp float;

varying float vHeight;

void main() {
    vec3 lowColor = vec3(0.2, 0.5, 0.3);    // Green for low areas
    vec3 midColor = vec3(0.6, 0.5, 0.3);    // Brown for middle areas
    vec3 highColor = vec3(0.8, 0.8, 0.8);   // White for peaks

                // Three-way color interpolation based on height
    vec3 baseColor = vec3(0.0);

    baseColor = mix(lowColor, midColor, smoothstep(0.0, 1.0, vHeight));

    float hightMix = step(1.0, vHeight);
    baseColor = mix(baseColor, highColor, hightMix);

    csm_DiffuseColor = vec4(baseColor, 1.0);
}