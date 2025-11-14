// src/compressionUtils.js

// 解压缩函数
export const decompressGzip = async (compressedBuffer) => {
  try {
    // 优先使用浏览器的 DecompressionStream API
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      writer.write(compressedBuffer);
      writer.close();
      
      const response = new Response(ds.readable);
      return await response.arrayBuffer();
    } else {
      // 后备方案：使用 pako
      console.warn('DecompressionStream not supported, falling back to pako');
      if (typeof pako !== 'undefined') {
        return pako.inflate(new Uint8Array(compressedBuffer)).buffer;
      } else {
        throw new Error('Gzip decompression not supported in this browser');
      }
    }
  } catch (error) {
    console.error('Decompression error:', error);
    throw error;
  }
};
