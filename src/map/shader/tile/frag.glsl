varying float vDiff;
varying vec2 vUV;
varying vec3 vHoverTileColor;

uniform sampler2D uTexture;
uniform bool uPureColor;

void main() {
    vec3 color = vec3(0., 0., 1.);

    if(uPureColor) {
        // 使用纯色
        float mix1 = smoothstep(0.001, 0.1, vDiff);
        color = mix(color, vec3(0., 1., 0.), mix1);

        float mix0 = step(2.1, vDiff);
        color = mix(color, vec3(0., 1.0, 0.5), mix0);

        float mix2 = step(6.1, vDiff);
        color = mix(color, vec3(1., 1., 0.), mix2);

        float mix3 = step(12.1, vDiff);
        color = mix(color, vec3(0.9), mix3);

        float mix4 = step(18.1, vDiff);
        color = mix(color, vec3(1.0), mix4);
    } else {
        vec4 tColor = texture2D(uTexture, vUV);
        color = tColor.rgb;

        // 叠加悬浮色
        color = color * vHoverTileColor;
    }

    // 昼夜效果
    // vec3 night = color * 0.002;
    // float sunOrientation = dot(uSunDir, fnormal);
    // float dayMix = smoothstep(-0.25, 0.5, sunOrientation);
    // color = mix(night, color, dayMix);

    csm_DiffuseColor = vec4(color, 1.0);
}