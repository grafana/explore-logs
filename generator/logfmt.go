package main

const LogFmtFormat = `ts=%s caller=%s.go:%d level=%s traceID=%s orgID=%s msg="%s" duration="%s"`

// func NewLogFmtApp(t time.Time) LogMessage {
// 	if rand.Intn(10) < 2 {
// 		return newHttpLogFmt(t)
// 	}
// 	level := randLevel()
// 	error := ""
// 	if level == ERROR {
// 		error = ` error="` + randError() + `"`
// 	}
// 	return LogMessage{
// 		Message: fmt.Sprintf(LogFmtFormat,
// 			t.Format(time.RFC3339Nano),
// 			randFileName(),
// 			gofakeit.Number(1, 300),
// 			level,
// 			randSeq(16),
// 			randOrgID(),
// 			gofakeit.Sentence(5),
// 			randDuration(),
// 		) + error,
// 		Level: level,
// 	}
// }

// ts=2024-02-28T23:04:12.760535253Z caller=http.go:194 level=debug traceID=279a41b78e22cad1 orgID=1218 msg="POST /ingester.v1.IngesterService/Push (200) 1.134561ms"
const httpLogFmtFormat = `ts=%s caller=http.go:194 level=%s traceID=%s orgID=%s msg="%s %s (%d) %s"`

// func newHttpLogFmt(t time.Time) LogMessage {
// 	status := gofakeit.HTTPStatusCode()
// 	level := INFO
// 	switch status / 100 {
// 	case 5:
// 		level = ERROR
// 	case 4:
// 		level = WARN
// 	}

// 	return LogMessage{
// 		Message: fmt.Sprintf(httpLogFmtFormat,
// 			t.Format(time.RFC3339Nano),
// 			level,
// 			randSeq(16),
// 			randOrgID(),
// 			gofakeit.HTTPMethod(),
// 			flog.RandResourceURI(),
// 			status,
// 			randDuration(),
// 		),
// 		Level: level,
// 	}
// }

// mysql
// `2020-08-06T14:25:02.835618Z 0 [Note] [MY-012487] [InnoDB] DDL log recovery : begin`,

const mysqlLogFmt = `%s %d [%s] [MY-00%d] [%s] %s`

// func NewMysqlLogFmt(t time.Time) LogMessage {
// 	return LogMessage{
// 		Message: fmt.Sprintf(mysqlLogFmt,
// 			t.Format(time.RFC3339Nano),
// 			gofakeit.Number(0, 4),
// 			randLevel(),
// 			gofakeit.Number(1, 20),
// 			gofakeit.HackerNoun(),
// 			gofakeit.HackerPhrase(),
// 		),
// 		Level:   randLevel(),
// 		Service: "mysql",
// 	}
// }
