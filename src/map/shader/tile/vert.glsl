attribute float elevation;
attribute float colorMix;

varying float vColorMix;
varying vec2 vUV;
varying vec3 xNormal;
varying vec3 vPosition;

void main() {
    float diff = step(0.001, colorMix);
    // 在着色器里直接修改顶点并没有改变原始的geometry顶点数据
    // 导致在射线投射时依然使用原始的顶点数据得到错误的交点
    // 解决办法是
    // 1： 着色器更改顶点后同步到geometry顶点数据中
    // 2： 直接更改geometry顶点数据后更新attribute
    // csm_Position += diff * colorMix * normal;

    vColorMix = colorMix;

    vUV = uv;

    // 这个normal在顶点变换后其实不准确
    xNormal = normal;
    vPosition = csm_Position.xyz;
}