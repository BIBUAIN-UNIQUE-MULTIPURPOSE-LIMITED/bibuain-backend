import {
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Message } from "./messages";
import { User } from "./user";

@Entity("chats")
export class Chat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToMany(() => User)
  @JoinTable({
    name: "chat_participants",
    joinColumn: {
      name: "chat_id",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "user_id",
      referencedColumnName: "id",
    },
  })
  participants!: User[];

  @OneToMany(() => Message, (message) => message.chat)
  messages!: Message[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
