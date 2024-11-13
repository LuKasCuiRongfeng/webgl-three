attribute float elevation;
attribute float colorMix;

varying float vColorMix;
varying vec2 vUV;
varying vec3 xNormal;
varying vec3 vPosition;

void main() {
    float diff = step(0.001, colorMix);
    csm_Position += diff * colorMix * normal;

    vColorMix = colorMix;

    vUV = uv;

    xNormal = normal;
    vPosition = csm_Position.xyz;
}