# 构建阶段
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -mod=readonly -ldflags="-s -w" -v -o server .

# 运行阶段
FROM alpine:latest

RUN apk add --no-cache tzdata ca-certificates && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

WORKDIR /app

COPY --from=builder /app/server /app/server

ENV PORT=80

EXPOSE 80

CMD ["/app/server"]
