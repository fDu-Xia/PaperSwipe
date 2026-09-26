FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
COPY web ./web
RUN CGO_ENABLED=0 go build -trimpath -o /paperswipe .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -g 10001 app && adduser -D -u 10001 -G app app && mkdir -p /app/data && chown app:app /app/data
WORKDIR /app
COPY --from=build /paperswipe /app/paperswipe
USER app
ENV ADDR=:8080 DATA_DIR=/app/data BETA_MODE=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/app/paperswipe"]
