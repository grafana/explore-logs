
FROM golang:1.22

WORKDIR /go/src/app

COPY go.mod go.sum ./
COPY *.go ./
COPY flog/ flog/

RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o /generator

ENTRYPOINT ["/generator"]
