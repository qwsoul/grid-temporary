# 1. Используем стабильный и легковесный LTS образ Node.js на базе Alpine Linux
FROM node:20-alpine

# 2. Указываем рабочую директорию внутри контейнера
WORKDIR /usr/src/app

# 3. Копируем файлы конфигурации зависимостей
COPY package*.json ./

# 4. Устанавливаем production-зависимости (без devDependencies)
RUN npm install --omit=dev

# 5. Копируем оставшийся исходный код бэкенда
COPY . .

# 6. Открываем порт
EXPOSE 10000

# 7. Запускаем сервер
CMD [ "npm", "start" ]
