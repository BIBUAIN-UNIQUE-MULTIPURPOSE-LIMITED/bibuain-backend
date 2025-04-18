import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    secure: true,
    port: 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const sendEmail = async (options: {
  from?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) => {
  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: options.from || process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to Send Email! Please Try Again.");
  }
};

export default sendEmail;
