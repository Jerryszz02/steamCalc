import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom 环境提供 document / localStorage，后续要给 app.js 这类
    // 碰 DOM 的模块写测试时无需再改配置
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      include: ['api.js', 'logic.js', 'app.js'],
    },
  },
});
