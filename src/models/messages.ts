import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Chat } from "./chats";
import { User } from "./user";

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { nullable: false })
  chat!: Chat;

  @ManyToOne(() => User, (user) => user.id, { nullable: false })
  sender!: User;

  @Column("text")
  content!: string;

  @Column({ type: "boolean", default: false })
  seen!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @Column({ type: "json", nullable: true })
  attachments?: Array<{
    url: string;
    type: string;
    name: string;
    size: number;
  }>;
}
