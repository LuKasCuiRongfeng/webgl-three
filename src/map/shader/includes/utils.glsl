

float resolveDataTexture(sampler2D uTexture) {
    // 左上角的第一个像素的r就是tile数量
    float tileCount = texture2D(uTexture, vec2(0., 1.)).r;
}