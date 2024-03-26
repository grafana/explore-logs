package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"time"

	"github.com/grafana/loki-client-go/loki"
	"github.com/prometheus/common/model"
)

func main() {
	url := flag.String("url", "http://localhost:3100/loki/api/v1/push", "Loki URL")
	dry := flag.Bool("dry", false, "Dry run: log to stdout instead of Loki")
	flag.Parse()

	cfg, err := loki.NewDefaultConfig(*url)
	if err != nil {
		panic(err)
	}
	cfg.BackoffConfig.MaxRetries = 1
	cfg.BackoffConfig.MinBackoff = 100 * time.Millisecond
	cfg.BackoffConfig.MaxBackoff = 100 * time.Millisecond
	client, err := loki.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Stop()

	var logger Logger = client
	if *dry {
		logger = LoggerFunc(func(labels model.LabelSet, timestamp time.Time, message string) error {
			fmt.Println(labels, timestamp, message)
			return nil
		})
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	// Creates and starts all apps.
	for namespace, apps := range generators {
		for serviceName, generator := range apps {
			ForAllClusters(namespace, serviceName, func(labels model.LabelSet) {
				generator(ctx, NewAppLogger(labels, logger))
			})
		}
	}
	startFailingMimirPod(ctx, logger)

	<-ctx.Done()
}
