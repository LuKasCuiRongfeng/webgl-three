varying vec3 vvNormal;
varying vec3 vPosition;

void main() {
    vvNormal = normal;
    vPosition = csm_Position.xyz;
}