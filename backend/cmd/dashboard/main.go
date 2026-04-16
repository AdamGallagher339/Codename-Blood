package main

import (
	"context"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/joho/godotenv"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/configdb"
)

type stats struct {
	TotalUsers     int    `json:"totalUsers"`
	ActiveRiders   int    `json:"activeRiders"`
	OnJobRiders    int    `json:"onJobRiders"`
	OfflineRiders  int    `json:"offlineRiders"`
	TotalJobs      int    `json:"totalJobs"`
	OpenJobs       int    `json:"openJobs"`
	AcceptedJobs   int    `json:"acceptedJobs"`
	InProgressJobs int    `json:"inProgressJobs"`
	DeliveredJobs  int    `json:"deliveredJobs"`
	CompletedJobs  int    `json:"completedJobs"`
	CancelledJobs  int    `json:"cancelledJobs"`
	TotalBikes     int    `json:"totalBikes"`
	ActiveBikes    int    `json:"activeBikes"`
	TotalEvents    int    `json:"totalEvents"`
	TotalApps      int    `json:"totalApplications"`
	PendingApps    int    `json:"pendingApplications"`
	ApprovedApps   int    `json:"approvedApplications"`
	GeneratedAt    string `json:"generatedAt"`
}

func main() {
	_ = godotenv.Load()

	ctx := context.Background()

	// Load config from DynamoDB AppConfig table (same as main app)
	tableName := os.Getenv("APP_CONFIG_TABLE")
	if tableName == "" {
		tableName = "AppConfig"
	}
	loaded, err := configdb.LoadEnvFromDynamo(ctx, tableName)
	if err != nil {
		log.Printf("Config DB env load skipped: %v", err)
	} else {
		log.Printf("Loaded %d env var(s) from DynamoDB table %s", loaded, tableName)
	}

	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("AWS config: %v", err)
	}
	ddb := dynamodb.NewFromConfig(cfg)

	port := os.Getenv("DASHBOARD_PORT")
	if port == "" {
		port = "9090"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s := gather(r.Context(), ddb)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := dashboardTmpl.Execute(w, s); err != nil {
			log.Printf("template: %v", err)
		}
	})

	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		s := gather(r.Context(), ddb)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)
	})

	addr := ":" + port
	log.Printf("Dashboard running on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// gather reads all configured DynamoDB tables and counts items.
func gather(ctx context.Context, ddb *dynamodb.Client) stats {
	s := stats{GeneratedAt: time.Now().UTC().Format("02 Jan 2006  15:04:05 UTC")}

	// ---- Users ----
	if t := os.Getenv("USERS_TABLE"); t != "" {
		out, err := ddb.Scan(ctx, &dynamodb.ScanInput{TableName: &t})
		if err == nil {
			s.TotalUsers = len(out.Items)
			for _, item := range out.Items {
				status := attrS(item, "status")
				switch status {
				case "available":
					s.ActiveRiders++
				case "on-job", "on-delivery":
					s.OnJobRiders++
				default:
					s.OfflineRiders++
				}
			}
		} else {
			log.Printf("scan USERS_TABLE: %v", err)
		}
	}

	// ---- Jobs ----
	if t := os.Getenv("JOBS_TABLE"); t != "" {
		out, err := ddb.Scan(ctx, &dynamodb.ScanInput{TableName: &t})
		if err == nil {
			s.TotalJobs = len(out.Items)
			for _, item := range out.Items {
				switch attrS(item, "status") {
				case "open":
					s.OpenJobs++
				case "accepted":
					s.AcceptedJobs++
				case "picked-up":
					s.InProgressJobs++
				case "delivered":
					s.DeliveredJobs++
				case "completed":
					s.CompletedJobs++
				case "cancelled":
					s.CancelledJobs++
				}
			}
		} else {
			log.Printf("scan JOBS_TABLE: %v", err)
		}
	}

	// ---- Bikes ----
	if t := os.Getenv("BIKES_TABLE"); t != "" {
		out, err := ddb.Scan(ctx, &dynamodb.ScanInput{TableName: &t})
		if err == nil {
			s.TotalBikes = len(out.Items)
			for _, item := range out.Items {
				if attrS(item, "currentRiderId") != "" {
					s.ActiveBikes++
				}
			}
		} else {
			log.Printf("scan BIKES_TABLE: %v", err)
		}
	}

	// ---- Events ----
	if t := os.Getenv("EVENTS_TABLE"); t != "" {
		out, err := ddb.Scan(ctx, &dynamodb.ScanInput{TableName: &t, Select: types.SelectCount})
		if err == nil {
			s.TotalEvents = int(out.Count)
		} else {
			log.Printf("scan EVENTS_TABLE: %v", err)
		}
	}

	// ---- Applications ----
	if t := os.Getenv("APPLICATIONS_TABLE"); t != "" {
		out, err := ddb.Scan(ctx, &dynamodb.ScanInput{TableName: &t})
		if err == nil {
			s.TotalApps = len(out.Items)
			for _, item := range out.Items {
				switch attrS(item, "status") {
				case "pending":
					s.PendingApps++
				case "approved":
					s.ApprovedApps++
				}
			}
		} else {
			log.Printf("scan APPLICATIONS_TABLE: %v", err)
		}
	}

	return s
}

func attrS(item map[string]types.AttributeValue, key string) string {
	if v, ok := item[key]; ok {
		if sv, ok := v.(*types.AttributeValueMemberS); ok {
			return sv.Value
		}
	}
	return ""
}

var dashboardTmpl = template.Must(template.New("dashboard").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blood Bike — Production Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f1117; color: #e4e4e7; min-height: 100vh; }
  header { background: #dc3545; padding: 20px 32px; }
  header h1 { font-size: 22px; color: #fff; }
  header p  { font-size: 13px; color: rgba(255,255,255,.7); margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px; padding: 24px 32px; }
  .card { background: #1a1d27; border-radius: 10px; padding: 20px 24px;
          border: 1px solid #2a2d37; }
  .card .label { font-size: 13px; color: #9ca3af; text-transform: uppercase;
                 letter-spacing: .5px; margin-bottom: 6px; }
  .card .value { font-size: 36px; font-weight: 700; }
  .section-title { padding: 24px 32px 0; font-size: 16px; color: #9ca3af;
                   text-transform: uppercase; letter-spacing: 1px; }
  .green  { color: #22c55e; }
  .red    { color: #ef4444; }
  .yellow { color: #eab308; }
  .blue   { color: #3b82f6; }
  .white  { color: #e4e4e7; }
  .purple { color: #a855f7; }
  footer { text-align: center; padding: 24px; color: #6b7280; font-size: 12px; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr 1fr; padding: 16px; }
    .card .value { font-size: 28px; } header { padding: 16px; } }
</style>
</head>
<body>
<header>
  <h1>Blood Bike Ireland — Production Dashboard</h1>
  <p>Last refreshed: {{.GeneratedAt}} &nbsp;·&nbsp; Auto-refreshes every 30s</p>
</header>

<h2 class="section-title">Riders</h2>
<div class="grid">
  <div class="card"><div class="label">Total Users</div><div class="value white">{{.TotalUsers}}</div></div>
  <div class="card"><div class="label">Active Riders</div><div class="value green">{{.ActiveRiders}}</div></div>
  <div class="card"><div class="label">On Job</div><div class="value yellow">{{.OnJobRiders}}</div></div>
  <div class="card"><div class="label">Offline</div><div class="value red">{{.OfflineRiders}}</div></div>
</div>

<h2 class="section-title">Jobs</h2>
<div class="grid">
  <div class="card"><div class="label">Total Jobs</div><div class="value white">{{.TotalJobs}}</div></div>
  <div class="card"><div class="label">Open</div><div class="value blue">{{.OpenJobs}}</div></div>
  <div class="card"><div class="label">Accepted</div><div class="value yellow">{{.AcceptedJobs}}</div></div>
  <div class="card"><div class="label">In Progress</div><div class="value yellow">{{.InProgressJobs}}</div></div>
  <div class="card"><div class="label">Delivered</div><div class="value green">{{.DeliveredJobs}}</div></div>
  <div class="card"><div class="label">Completed</div><div class="value green">{{.CompletedJobs}}</div></div>
  <div class="card"><div class="label">Cancelled</div><div class="value red">{{.CancelledJobs}}</div></div>
</div>

<h2 class="section-title">Fleet</h2>
<div class="grid">
  <div class="card"><div class="label">Total Bikes</div><div class="value white">{{.TotalBikes}}</div></div>
  <div class="card"><div class="label">Bikes In Use</div><div class="value green">{{.ActiveBikes}}</div></div>
  <div class="card"><div class="label">Community Events</div><div class="value purple">{{.TotalEvents}}</div></div>
</div>

<h2 class="section-title">Applications</h2>
<div class="grid">
  <div class="card"><div class="label">Total Applications</div><div class="value white">{{.TotalApps}}</div></div>
  <div class="card"><div class="label">Pending Review</div><div class="value yellow">{{.PendingApps}}</div></div>
  <div class="card"><div class="label">Approved</div><div class="value green">{{.ApprovedApps}}</div></div>
</div>

<footer>Blood Bike Ireland &mdash; Internal Dashboard</footer>

<script>setTimeout(()=>location.reload(), 30000);</script>
</body>
</html>
`))
