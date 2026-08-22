import { describe, it, expect, vi } from "vitest";
import { NodemailerMailer } from "../src/reminders/Mailer.js";

describe("NodemailerMailer", () => {
  it("sends through the given transport, addressed from config's mail.from", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const transport = { sendMail };

    const mailer = new NodemailerMailer(transport, "reminders@example.com");
    await mailer.send("alice@example.com", { subject: "Reminder: MRI tomorrow", body: "Doctor: Dr. Cohen" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "reminders@example.com",
      to: "alice@example.com",
      subject: "Reminder: MRI tomorrow",
      text: "Doctor: Dr. Cohen",
    });
  });

  it("propagates a transport failure instead of swallowing it (caller needs to know to retry)", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP connection refused"));
    const transport = { sendMail };
    const mailer = new NodemailerMailer(transport, "reminders@example.com");

    await expect(mailer.send("alice@example.com", { subject: "s", body: "b" })).rejects.toThrow(
      "SMTP connection refused",
    );
  });
});
