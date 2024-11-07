attribute float elevation;
attribute float colorMix;
varying float vColorMix;
varying vec2 vUV;

void main() {
    csm_Position += elevation * normal;

    vColorMix = colorMix;

    vUV = uv;
}