############################################
# 1단계: Vue 빌드 스테이지
# - Node.js 환경에서 Vue/Vite 프로젝트를 빌드
############################################
FROM node:20-alpine AS build

# 빌드 인자 (환경 변수)
ARG VITE_APP_API_URL
ENV VITE_APP_API_URL=${VITE_APP_API_URL}

# 컨테이너 내부 작업 디렉토리
WORKDIR /app

# package.json, package-lock.json 먼저 복사
# → 의존성 설치 캐시를 최대한 활용하기 위함
COPY package*.json ./

# npm ci:
# - package-lock.json 기준으로 정확하게 설치
# - CI/CD 환경에서 재현성 좋음
# - devDependencies도 설치 (빌드에 필요: vite, @vitejs/plugin-vue 등)
RUN npm ci

# 나머지 소스 코드 복사
COPY . .

# Vue 프로젝트 빌드
# 결과물은 dist/ 디렉토리에 생성됨
RUN npm run build


############################################
# 2단계: nginx로 정적 파일 서빙
# - Node, npm 없이 nginx만으로 프론트 서비스
############################################
FROM nginx:alpine

# 빌드된 정적 파일(dist)을
# nginx 기본 정적 파일 경로로 복사
COPY --from=build /app/dist /usr/share/nginx/html

# nginx 설정 파일 복사 (Vue Router history mode 지원)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 불필요한 파일 제거 (보안)
RUN rm -rf /usr/share/nginx/html/*.map

# nginx는 기본적으로 80 포트 사용
EXPOSE 80

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# nginx 실행 (데몬 모드 비활성화)
CMD ["nginx", "-g", "daemon off;"]
