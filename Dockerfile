FROM node:20-alpine AS builder

# 接收构建平台参数
ARG TARGETPLATFORM

WORKDIR /app

# 1. 复制依赖文件并安装（根据平台调整）
COPY package*.json ./
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        npm install --ignore-scripts && \
        npm install esbuild-wasm; \
    else \
        npm install; \
    fi

# 2. 复制源码（必须在构建之前）
COPY src ./src
COPY public ./public

# 3. 执行构建（arm64 强制使用 WASM）
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        ESBUILD_USE_WASM=1 npm run build:node; \
    else \
        npm run build:node; \
    fi

# ---------- 运行阶段 ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY --from=builder /app/dist ./dist
COPY public ./public

EXPOSE 8787

CMD ["node", "dist/node-server.cjs"]