import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from "typeorm";

export enum TemplateType {
  WELCOME = "welcome",
  PAYMENT_MADE = "payment_made",
  COIN_RELEASE = "coin_release",
}

export enum Platform {
  PAXFUL = "paxful",
  NOONES = "noones",
}

@Entity("message_templates")
@Index(["type", "platform", "isActive"])
export class AutoMessageTemplate {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: TemplateType,
    comment: "Type of auto-message template",
  })
  type!: TemplateType;

  @Column({
    type: "enum",
    enum: Platform,
    comment: "Platform for which this template is used",
  })
  platform!: Platform;

  @Column({
    type: "text",
    comment: "Content of the message template with variable placeholders",
  })
  content!: string;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "Available variables that can be used in the template",
  })
  availableVariables!: {
    name: string;
    description: string;
    defaultValue?: string;
  }[];

  @Column({
    type: "int",
    nullable: true,
    comment: "Delay in minutes before sending follow-up message",
  })
  followUpDelayMinutes!: number;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "Follow-up message content if needed",
  })
  followUpContent!: {
    content: string;
    conditions?: Record<string, any>;
  }[];

  @Column({
    type: "boolean",
    default: true,
    comment: "Whether this template is currently active",
  })
  isActive!: boolean;

  @Column({
    type: "int",
    default: 0,
    comment: "Order of template when multiple templates exist for same type",
  })
  displayOrder!: number;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "Feedback templates for automated feedback",
  })
  feedbackTemplates?: string[];

  @Column({
    type: "simple-array",
    nullable: true,
    comment: "Tags for template categorization and filtering",
  })
  tags!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;

  @Column({
    type: "uuid",
    comment: "ID of admin who created this template",
  })
  createdBy!: string;

  @Column({
    type: "uuid",
    nullable: true,
    comment: "ID of admin who last updated this template",
  })
  updatedBy!: string;
}
