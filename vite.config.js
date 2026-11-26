import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  build:{rollupOptions:{output:{manualChunks:{
    react:['react','react-dom','react-router-dom'],
    charts:['recharts'],
    map:['leaflet','react-leaflet']}}}},
  test:{environment:'node',include:['tests/**/*.test.{js,jsx}']}
});
