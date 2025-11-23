FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json next.config.mjs .eslintrc.cjs ./
RUN npm install

COPY src ./src
COPY public ./public

ENV PORT=3000
EXPOSE 3000

RUN npm run build

CMD ["npm", "run", "start"]
