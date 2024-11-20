attribute float aEle;
attribute float aWaterEle;
attribute float aTileId;

varying float vEle;
varying float vWaterELe;
varying vec2 vUV;
varying vec3 vHoverTileColor;

uniform float uMouseMode;
uniform int uTileCount;
uniform bool uPureColor;
uniform float uTileHoverArray[500];

const vec3 hoverColor = vec3(0., 1., 0.);

void main() {
    float altitude = max(aEle, aWaterEle);

    // 在着色器里直接修改顶点并没有改变原始的geometry顶点数据
    // 导致在射线投射时依然使用原始的顶点数据得到错误的交点
    // 解决办法是
    // 1： 着色器更改顶点后同步到geometry顶点数据中
    // 2： 直接更改geometry顶点数据后更新attribute

    vHoverTileColor = vec3(1.);

    // 处理海拔
    if(uPureColor == false && uMouseMode == 0.) {
        float fuck = 1.;
        // 第一个值是海拔
        float elevation = uTileHoverArray[0];
        for(int i = 1; i <= uTileCount; i++) {
            fuck *= abs(uTileHoverArray[i] - aTileId);
            if(fuck == 0.) {
                break;
            }
        }

        // 如果当前地块在这个数组中，则 fuck = 1.0，否则fuck = 0.0
        fuck = 1. - step(0.001, fuck);

        csm_Position.xyz += (max(elevation, aWaterEle) - altitude) * fuck * normal;

        vHoverTileColor = mix(vec3(1.0), hoverColor, fuck);
    }

    // 处理山脉
    if(uPureColor == false && uMouseMode == 2.) {
        float tile = uTileHoverArray[0];
        float vert = uTileHoverArray[1];
        if(tile == aTileId && int(vert) == gl_VertexID) {
            // 直接拔高三个单位
            csm_Position.xyz += 3. * normal;
            vHoverTileColor = hoverColor;
        }
    }

    // 处理植被
    if(uPureColor == false && uMouseMode == 3.) {
        float fuck = 1.;
        // 第一个值
        float value = uTileHoverArray[0];

        for(int i = 1; i <= uTileCount; i++) {
            fuck *= abs(uTileHoverArray[i] - aTileId);
            if(fuck == 0.) {
                break;
            }
        }

        // 如果当前地块在这个数组中，则 fuck = 1.0，否则fuck = 0.0
        fuck = 1. - step(0.001, fuck);

        vHoverTileColor = mix(vec3(1.0), hoverColor, fuck);
    }

    vEle = aEle;
    vWaterELe = aWaterEle;
    vUV = uv;
}