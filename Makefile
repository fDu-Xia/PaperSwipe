.PHONY: run test fmt

run:
	go run .

test:
	go test ./...

fmt:
	gofmt -w *.go

