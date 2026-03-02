from sqlalchemy import (
    Column, Integer, String, Float, Date, Boolean, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    first_game_date = Column(Date)
    is_active = Column(Boolean, default=False)


class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    start_date = Column(Date)
    quarter = Column(Integer)


class BlockRoster(Base):
    __tablename__ = "block_rosters"

    id = Column(Integer, primary_key=True)
    block_id = Column(Integer, ForeignKey("blocks.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    is_regular = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("block_id", "player_id"),
    )


class GameResult(Base):
    __tablename__ = "game_results"

    id = Column(Integer, primary_key=True)
    block_id = Column(Integer, ForeignKey("blocks.id"), nullable=False)
    week_number = Column(Integer, nullable=False)
    game_date = Column(Date)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    result = Column(String(1), nullable=False)  # W, L, D
    is_sub = Column(Boolean, default=False)
    replaced_player_id = Column(Integer, ForeignKey("players.id"))
    goals_for = Column(Integer)
    goals_against = Column(Integer)


class HeadToHead(Base):
    __tablename__ = "head_to_head"

    id = Column(Integer, primary_key=True)
    player_a_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player_b_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    goals_scored = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("player_a_id", "player_b_id"),
    )


class MomAward(Base):
    __tablename__ = "mom_awards"

    id = Column(Integer, primary_key=True)
    block_id = Column(Integer, ForeignKey("blocks.id"))
    game_date = Column(Date)
    week_number = Column(Integer)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    votes = Column(Integer, default=0)
    score = Column(Float, default=0.0)


class LeagueStanding(Base):
    __tablename__ = "league_standings"

    id = Column(Integer, primary_key=True)
    block_id = Column(Integer, ForeignKey("blocks.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    played = Column(Integer, default=0)
    won = Column(Integer, default=0)
    drawn = Column(Integer, default=0)
    lost = Column(Integer, default=0)
    points = Column(Float, default=0.0)
    goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0)
    goal_difference = Column(Integer, default=0)
    mom_bonus = Column(Integer, default=0)
    ppg = Column(Float, default=0.0)
