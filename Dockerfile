FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# 根据目标平台决定是否忽略安装脚本（arm64 下 QEMU 模拟常崩溃）
ARG TARGETPLATFORM
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        npm install --ignore-scripts; \
    else \
        npm install; \
    fi

# 对于 arm64，确保 esbuild 等工具能正常工作（触发二进制下载，但不会在 QEMU 下跑 install 脚本）
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        npx esbuild --version || true; \
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
