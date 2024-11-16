attribute float elevation;
attribute float colorMix;
attribute float aTileId;

varying float vColorMix;
varying vec2 vUV;
varying vec3 xNormal;
varying vec3 vPosition;
varying vec3 vHoverTileColor;

uniform sampler2D uDataTexture;
uniform float uMouseMode;
uniform int uTileCount;
uniform bool uPureColor;
uniform float uTile[500];

void main() {
    float diff = step(0.001, colorMix);
    diff *= colorMix;
    // 在着色器里直接修改顶点并没有改变原始的geometry顶点数据
    // 导致在射线投射时依然使用原始的顶点数据得到错误的交点
    // 解决办法是
    // 1： 着色器更改顶点后同步到geometry顶点数据中
    // 2： 直接更改geometry顶点数据后更新attribute
    // csm_Position += diff * normal;
    vHoverTileColor = vec3(1.);

    if(uPureColor == false && uMouseMode == 0.) {
        float fuck = 1.;
        for (int i = 0; i < uTileCount; i++) {
            fuck *= abs(uTile[i] - aTileId);
            if (fuck == 0.) {
                break;
            }
        }

        // float t0 = uTile[0];
        // float t1 = uTile[1];
        // float t2 = uTile[2];
        // float t3 = uTile[3];
        // float t4 = uTile[4];
        // float t5 = uTile[5];
        // float t6 = uTile[6];
        // float t7 = uTile[7];
        // float t8 = uTile[8];
        // float t9 = uTile[9];
        // float t10 = uTile[10];
        // float t11 = uTile[11];
        // float t12 = uTile[12];
        // float t13 = uTile[13];
        // float t14 = uTile[14];
        // float t15 = uTile[15];
        // float t16 = uTile[16];
        // float t17 = uTile[17];
        // float t18 = uTile[18];

        // float fuck = abs(aTileId - t0) *
        //     abs(aTileId - t1) *
        //     abs(aTileId - t2) *
        //     abs(aTileId - t3) *
        //     abs(aTileId - t4) *
        //     abs(aTileId - t5) *
        //     abs(aTileId - t6) *
        //     abs(aTileId - t7) *
        //     abs(aTileId - t8) *
        //     abs(aTileId - t9) *
        //     abs(aTileId - t10) *
        //     abs(aTileId - t11) *
        //     abs(aTileId - t12) *
        //     abs(aTileId - t13) *
        //     abs(aTileId - t14) *
        //     abs(aTileId - t15) *
        //     abs(aTileId - t16) *
        //     abs(aTileId - t17) *
        //     abs(aTileId - t18);

        // 击中 = 1, 没击中 = 0
        fuck = 1. - step(0.001, fuck);

        csm_Position.xyz += (5.0 - diff) * fuck * normal;

        vHoverTileColor = mix(vec3(1.0), vec3(0., 1.0, 0.), fuck);
    }

    // if(uPureColor == false && uMouseMode == 0.) {
    //     // 处理海拔
    //     // 每一行
    //     float yStep = 1.0 / float(uTileCount);
    //     float yHalfStep = yStep / 2.;

    //     float xStep = 1.0 / 4.;
    //     float xHalfStep = xStep / 2.;

    //     for(int i = 0; i < uTileCount; i++) {
    //         // y 坐标，取每个像素的中间
    //         float y = 1.0 - float(i) * yStep - yHalfStep;

    //         // 每行 4个像素
    //         // 第一个像素
    //         // tileid
    //         vec4 p1 = texture2D(uDataTexture, vec2(xStep * 0. + xHalfStep, y));
    //         // vec4 p2 = texture2D(uDataTexture, vec2(xStep * 1. + xHalfStep, y));
    //         // vec4 p3 = texture2D(uDataTexture, vec2(xStep * 2. + xHalfStep, y));
    //         // vec4 p4 = texture2D(uDataTexture, vec2(xStep * 3. + xHalfStep, y));

    //         float tileId = p1.r;

    //         if(tileId == aTileId) {
    //             csm_Position.xyz += (5.0 - diff) * normal;
    //             vHoverTileColor =  vec3(0.36, 0.79, 0.36);
    //             break;
    //             // float edgeCount = p1.g;
    //             // float v1 = p1.b;
    //             // float v2 = p1.a;

    //             // float v3 = p2.r;
    //             // float v4 = p2.g;
    //             // float v5 = p2.b;
    //             // float v6 = p2.a;

    //             // float v7 = p3.r;
    //             // float v8 = p3.g;
    //             // float v9 = p3.b;
    //             // float v10 = p3.a;

    //             // float v11 = p4.r;
    //             // float v12 = p4.g;
    //             // float v13 = p4.b;

    //             // if(edgeCount == 6.0 || edgeCount == 5.0) {
    //             //     // if(gl_VertexID == int(v6) ||
    //             //     //     gl_VertexID == int(v7) ||
    //             //     //     gl_VertexID == int(v8) ||
    //             //     //     gl_VertexID == int(v9) ||
    //             //     //     gl_VertexID == int(v10) ||
    //             //     //     gl_VertexID == int(v11)) {
    //             //     //     csm_Position.xyz += (5.0 - diff) * normal;
    //             //     // }
    //             //     // csm_Position.xyz += (5.0 - diff) * normal;
    //             //     // vHoverTileColor =  vec3(0.36, 0.79, 0.36);
    //             //     break;
    //             // }
    //             // else {
    //             //     if(gl_VertexID == int(v7) ||
    //             //         gl_VertexID == int(v8) ||
    //             //         gl_VertexID == int(v9) ||
    //             //         gl_VertexID == int(v10) ||
    //             //         gl_VertexID == int(v11) ||
    //             //         gl_VertexID == int(v12) ||
    //             //         gl_VertexID == int(v13)) {
    //             //         csm_Position.xyz += (5.0 - diff) * normal;
    //             //         break;
    //             //     }
    //             // }
    //         }
    //     }
    // }

    vColorMix = colorMix;

    vUV = uv;

    // 这个normal在顶点变换后其实不准确
    xNormal = normal;
    vPosition = csm_Position.xyz;
}