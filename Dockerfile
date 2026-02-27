# SAMI Weekly Reports - Docker Configuration
# Multi-stage build for optimized image size

# ================================
# Stage 1: Build
# ================================
FROM node:18-alpine AS builder

WORKDIR /app

# Копіюємо package files для кешування залежностей
COPY package*.json ./

# Встановлюємо всі залежності (включаючи dev для збірки)
RUN npm ci

# Копіюємо вихідний код
COPY . .

# Збираємо TypeScript
RUN npm run build

# Видаляємо dev залежності
RUN npm prune --production

# ================================
# Stage 2: Production
# ================================
FROM node:18-alpine AS production

WORKDIR /app

# Встановлюємо необхідні системні пакети
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Створюємо non-root користувача
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Копіюємо зібраний код та node_modules з builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Створюємо директорії для даних та логів
RUN mkdir -p data logs temp && \
    chown -R nodejs:nodejs data logs temp

# Перемикаємось на non-root користувача
USER nodejs

# Відкриваємо порт API
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Змінні середовища за замовчуванням
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Точка входу
CMD ["node", "dist/index.js"]
