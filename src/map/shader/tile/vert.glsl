attribute float aDiff;
attribute float aTileId;

varying float vDiff;
varying vec2 vUV;
varying vec3 vHoverTileColor;

uniform float uMouseMode;
uniform int uTileCount;
uniform bool uPureColor;
uniform float uTile[500];

void main() {
    float diff = step(0.001, aDiff);
    diff *= aDiff;

    // 在着色器里直接修改顶点并没有改变原始的geometry顶点数据
    // 导致在射线投射时依然使用原始的顶点数据得到错误的交点
    // 解决办法是
    // 1： 着色器更改顶点后同步到geometry顶点数据中
    // 2： 直接更改geometry顶点数据后更新attribute
    // csm_Position += diff * normal;
    vHoverTileColor = vec3(1.);

    // 处理海拔
    if(uPureColor == false && uMouseMode == 0.) {
        float fuck = 1.;
        // 第一个值是海拔
        float elevation = uTile[0];
        for(int i = 1; i <= uTileCount; i++) {
            fuck *= abs(uTile[i] - aTileId);
            if(fuck == 0.) {
                break;
            }
        }

        // 如果当前地块在这个数组中，则 fuck = 1.0，否则fuck = 0.0
        fuck = 1. - step(0.001, fuck);

        csm_Position.xyz += (elevation - diff) * fuck * normal;

        vHoverTileColor = mix(vec3(1.0), vec3(0., 1.0, 0.), fuck);
    }

    // 处理山脉
    if(uPureColor == false && uMouseMode == 2.) {
        float tile = uTile[0];
        float vert = uTile[1];
        if(tile == aTileId && int(vert) == gl_VertexID) {
            // 直接拔高三个单位
            csm_Position.xyz += 3. * normal;
            vHoverTileColor = vec3(0., 1.0, 0.);
        }
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

    vDiff = diff;
    vUV = uv;
}