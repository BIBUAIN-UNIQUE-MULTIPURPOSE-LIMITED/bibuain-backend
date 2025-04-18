import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user";
import { Message } from "./messages";

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
