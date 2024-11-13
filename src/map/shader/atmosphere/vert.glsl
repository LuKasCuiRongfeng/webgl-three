varying vec3 xNormal;
varying vec3 vPosition;

void main() {
    xNormal = normal;
    vPosition = csm_Position.xyz;
}