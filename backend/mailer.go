package main

import (
	"embed"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/cron"
	"github.com/pocketbase/pocketbase/tools/template"
	"github.com/s-petr/longhabit/notifier"
)

//go:embed templates
var embeddedTemplates embed.FS

// startNotifier initializes and starts the email notification scheduler.
// It sets up a cron job that periodically sends email reminders
// to users based on the configured schedule.
func (app *application) startNotifier() {
	app.pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		scheduler := cron.New()
		mailNotifier := notifier.NewNotifier(
			app.pb,
			embeddedTemplates,
			app.config.mailerNumWorkers,
		)

		scheduler.MustAdd(
			"email-reminders",
			app.config.mailerCronSchedule,
			func() { mailNotifier.NotifyUsers() },
		)

		scheduler.Start()
		return e.Next()
	})

}

// loadAuthEmailTemplates loads custom email templates and overrides
// the framework's default email verification and password reset emails
func (app *application) loadAuthEmailTemplates() {
	app.pb.OnMailerRecordVerificationSend().BindFunc(func(e *core.MailerRecordEvent) error {
		title := "Long Habit - Verify Email"

		registry := template.NewRegistry()
		html, err := registry.LoadFS(embeddedTemplates,
			"templates/base.layout.gohtml",
			"templates/styles.partial.gohtml",
			"templates/verify-email.page.gohtml").
			Render(map[string]any{
				"title":  title,
				"domain": app.pb.Settings().Meta.AppURL,
				"token":  e.Meta["token"],
			})
		if err != nil {
			return err
		}

		e.Message.Subject = title
		e.Message.HTML = html

		return e.Next()
	})

	app.pb.OnMailerRecordPasswordResetSend().BindFunc(func(e *core.MailerRecordEvent) error {
		title := "Long Habit - Reset Password"

		registry := template.NewRegistry()
		html, err := registry.LoadFS(embeddedTemplates,
			"templates/base.layout.gohtml",
			"templates/styles.partial.gohtml",
			"templates/reset-password.page.gohtml").
			Render(map[string]any{
				"title":  title,
				"domain": app.pb.Settings().Meta.AppURL,
				"token":  e.Meta["token"],
			})
		if err != nil {
			return err
		}

		e.Message.Subject = title
		e.Message.HTML = html

		return e.Next()
	})
}
