FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# 根据目标平台决定是否忽略安装脚本（arm64 下 QEMU 模拟常崩溃）
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        npm install --ignore-scripts && \
        npm install esbuild-wasm && \
        ESBUILD_USE_WASM=1 npm run build:node; \
    else \
        npm install && \
        npm run build:node; \
    fi
COPY src ./src
COPY public ./public

RUN npm run build:node

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY --from=builder /app/dist ./dist
COPY public ./public

EXPOSE 8787

CMD ["node", "dist/node-server.cjs"]
