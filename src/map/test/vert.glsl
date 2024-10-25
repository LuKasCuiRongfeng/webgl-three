attribute float elevation;
attribute float face;
varying float vHeight;

#include ../includes/simplex_noise3.glsl

void main() {
    float elevation = snoise(csm_Position);
    elevation += snoise(csm_Position) / 2.;
    elevation += snoise(csm_Position) / 2.;

    elevation = pow(elevation, 2.);
    csm_Position += normal * elevation;

    vHeight = elevation;
}