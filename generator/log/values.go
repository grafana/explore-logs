package log

import (
	"github.com/brianvoe/gofakeit/v7"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
	"math/rand"
	"strconv"
	"strings"
	"time"
)

var Clusters = []string{
	"us-west-1",
	"us-east-1",
	"us-east-2",
	"eu-west-1",
}

var shards = []string{
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"",
}

var namespaces = []string{
	"prod",
	"dev",
	"staging",
	"infra",
	"monitoring",
}

var services = []string{
	"api",
	"web",
	"db",
	"cache",
	"queue",
	"worker",
	"cart",
	"checkout",
	"payment",
	"shipping",
	"order",
}

var URI = []string{
	"/api/loki/v1/query",
	"/api/loki/v1/push",
	"/api/loki/v1/patterns",
	"/api/loki/v1/label",
	"/api/loki/v1/label/values",
	"/api/loki/v1/label/names",
	"/api/loki/v1/label/series",
	"/api/mimir/v1/query",
	"/api/mimir/v1/push",
	"/api/mimir/v1/label",
	"/api/mimir/v1/label/values",
	"/api/pyroscope/v1/query",
	"/api/pyroscope/v1/push",
}

const (
	INFO  = model.LabelValue("info")
	ERROR = model.LabelValue("error")
	WARN  = model.LabelValue("warn")
	DEBUG = model.LabelValue("debug")
)

var level = []model.LabelValue{
	DEBUG,
	INFO,
	WARN,
	ERROR,
}

var OrgIDs = []string{"1218", "29", "1010", "2419", "2919"}
var UserIDs = []string{"14234", "03428", "10572", "94223", "08203", "93820", "12345", "54321", "67890"}

var defaultTraceId = gofakeit.UUID()

var lessRandomPodLabelName = "tempo-ingester"

func RandLevel() model.LabelValue {
	r := rand.Intn(100)
	if r < 5 {
		return ERROR
	} else if r < 10 {
		return WARN
	} else {
		return level[rand.Intn(len(level)-2)]
	}
}

func RandURI() string {
	return URI[rand.Intn(len(URI))]
}

func ForAllClusters(namespace, svc model.LabelValue, cb func(model.LabelSet, push.LabelsAdapter)) {
	podCount := rand.Intn(10) + 1
	if string(svc) == lessRandomPodLabelName {
		podCount = 8
	}
	for _, cluster := range Clusters {
		for i := 0; i < podCount; i++ {
			clusterInt := 0
			for _, char := range cluster {
				clusterInt += int(char)
			}

			cb(model.LabelSet{
				"env":              model.LabelValue(namespaces[rand.Intn(len(namespaces))]),
				"cluster":          model.LabelValue(cluster),
				"__stream_shard__": model.LabelValue(shards[clusterInt%len(shards)]),
				"namespace":        namespace,
				"service_name":     svc,
				"file":             "C:\\Grafana\\logs\\" + namespace + ".txt",
			}, RandStructuredMetadata(string(svc), i))
		}
	}
}

func RandSeq(n int) string {
	letters := []rune("abcdefghijklmnopqrstuvwxyz0123456789")
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func RandOrgID() string {
	return OrgIDs[rand.Intn(len(OrgIDs))]
}

func RandUserID() string {
	return UserIDs[rand.Intn(len(UserIDs))]
}

func RandError() string {
	switch rand.Intn(10) {
	case 0:
		return gofakeit.ErrorDatabase().Error()
	case 1:
		return gofakeit.ErrorGRPC().Error()
	case 2:
		return gofakeit.ErrorObject().Error()
	case 3:
		return gofakeit.ErrorRuntime().Error()
	case 4:
		return gofakeit.ErrorHTTP().Error()
	default:
		return gofakeit.Error().Error()
	}
}

var filesNames = []string{gofakeit.ProductName(), gofakeit.ProductName(), gofakeit.ProductName(), gofakeit.Word(), gofakeit.Word()}

func RandFileName() string {
	return strings.ReplaceAll(strings.ToLower(filesNames[rand.Intn(len(filesNames))]), " ", "_")
}

func RandDuration() string {
	return (time.Duration(gofakeit.Number(1, 30000)) * time.Millisecond).String()
}

func RandTraceID(prevTrace string) string {
	// 50% chance to use `prevTrace` if it is set
	if prevTrace != "" && rand.Intn(2) == 0 {
		return prevTrace
	}

	newTrace := gofakeit.UUID()
	defaultTraceId = newTrace
	return newTrace
}

func RandStructuredMetadata(svc string, index int) push.LabelsAdapter {
	podName := svc + "-" + RandSeq(5)
	if svc == lessRandomPodLabelName {
		// Hardcode the pod name ID for the tempo-ingester service so we can consistently query metadata in e2e tests.
		podName = lessRandomPodLabelName + "-hc-" + strconv.Itoa(index) + RandSeq(3)
	}
	return push.LabelsAdapter{
		push.LabelAdapter{Name: "traceID", Value: RandTraceID(defaultTraceId)},
		push.LabelAdapter{Name: "pod", Value: podName},
		push.LabelAdapter{Name: "user", Value: RandUserID()},
	}
}
