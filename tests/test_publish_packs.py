"""tools/publish_packs.py: copy the bundled packs into a checkout of amluto-solutions/home-3d-packs (#27).
No network."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("publish_packs", ROOT / "tools" / "publish_packs.py")
assert _spec and _spec.loader
publish_packs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(publish_packs)

BUNDLED = ROOT / "custom_components" / "home_3d" / "bundled_packs"

CHAIR = {
    "id": "cube_chair",
    "name": {"en": "Cube chair"},
    "size": [0.8, 0.8, 0.75],
    "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}],
}


def _pack(root: Path, pack_id: str, *, name: str = "Starter", release: int = 1, **extra: str) -> Path:
    folder = root / pack_id
    (folder / "seating").mkdir(parents=True)
    pack = {
        "format": "home3d-pack",
        "version": 2,
        "id": pack_id,
        "name": name,
        "publisher": "Test",
        "licence": "MIT",
        "release": release,
        "description": "Chairs for tests.",
        **extra,
    }
    (folder / "pack.json").write_text(json.dumps(pack), encoding="utf-8")
    (folder / "seating" / "cube_chair.json").write_text(json.dumps(CHAIR), encoding="utf-8")
    (folder / "LICENSE").write_text("MIT License\n\nCopyright (c) 2026 Test\n", encoding="utf-8")
    return folder


def _tree(root: Path) -> dict[str, str]:
    return {
        p.relative_to(root).as_posix(): p.read_text(encoding="utf-8")
        for p in sorted(root.rglob("*"))
        if p.is_file() and ".git" not in p.relative_to(root).parts
    }


def test_each_pack_folder_is_copied_whole(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    _pack(source, "test.two")
    target.mkdir()

    published = publish_packs.publish(target, source)

    assert published == ["test.one", "test.two"]
    for pack_id in published:
        assert _tree(target / pack_id) == _tree(source / pack_id)


def test_files_removed_from_a_pack_are_removed_from_the_checkout(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    (target / "test.one" / "seating").mkdir(parents=True)
    (target / "test.one" / "seating" / "old_chair.json").write_text("{}", encoding="utf-8")

    publish_packs.publish(target, source)

    assert not (target / "test.one" / "seating" / "old_chair.json").exists()
    assert (target / "test.one" / "seating" / "cube_chair.json").exists()


def test_git_data_and_other_files_in_the_checkout_are_left_alone(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    (target / ".git").mkdir(parents=True)
    (target / ".git" / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
    (target / "other-pack").mkdir()
    (target / "other-pack" / "pack.json").write_text("{}", encoding="utf-8")

    publish_packs.publish(target, source)

    assert (target / ".git" / "HEAD").read_text(encoding="utf-8") == "ref: refs/heads/main\n"
    assert (target / "other-pack" / "pack.json").exists()


def test_a_pack_that_fails_validation_stops_everything(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.good")
    bad = _pack(source, "test.bad")
    (bad / "seating" / "cube_chair.json").write_text(json.dumps({**CHAIR, "parts": []}), encoding="utf-8")
    target.mkdir()

    with pytest.raises(publish_packs.PublishError, match=r"test.bad"):
        publish_packs.publish(target, source)

    assert list(target.iterdir()) == []


def test_a_changed_pack_needs_a_new_release(tmp_path: Path) -> None:
    """The update check compares releases, so a change published under the same release would never be offered (#47).
    Nothing is written then; the same content again, or a change with a higher release, publishes."""
    source, target = tmp_path / "source", tmp_path / "packs"
    target.mkdir()
    folder = _pack(source, "test.one")
    _pack(source, "test.two")
    publish_packs.publish(target, source)
    before = _tree(target)
    assert publish_packs.publish(target, source) == ["test.one", "test.two"]

    (folder / "seating" / "cube_chair.json").write_text(json.dumps({**CHAIR, "size": [1, 1, 1]}), encoding="utf-8")
    with pytest.raises(publish_packs.PublishError, match=r"test.one.*release"):
        publish_packs.publish(target, source)
    assert _tree(target) == before

    pack = json.loads((folder / "pack.json").read_text(encoding="utf-8"))
    (folder / "pack.json").write_text(json.dumps({**pack, "release": 2}), encoding="utf-8")
    publish_packs.publish(target, source)
    assert json.loads((target / "test.one" / "pack.json").read_text(encoding="utf-8"))["release"] == 2


def test_a_folder_name_that_is_not_the_pack_id_is_refused(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one").rename(source / "test.renamed")
    target.mkdir()

    with pytest.raises(publish_packs.PublishError, match=r"test.renamed"):
        publish_packs.publish(target, source)


def test_the_readme_lists_every_pack_with_its_install_url(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one", name="Chair pack", release=4)
    target.mkdir()

    publish_packs.publish(target, source)

    readme = (target / "README.md").read_text(encoding="utf-8")
    assert "Chair pack" in readme
    assert "`test.one`" in readme
    assert "https://github.com/amluto-solutions/home-3d-packs/tree/main/test.one" in readme
    assert "release 4" in readme
    assert "1 item" in readme
    assert "Chairs for tests." in readme
    assert "MIT" in readme


def test_the_ikea_notice_is_written_only_when_the_ikea_pack_is_published(tmp_path: Path) -> None:
    source, plain, with_ikea = tmp_path / "source", tmp_path / "plain", tmp_path / "ikea"
    _pack(source, "test.one")
    plain.mkdir()
    with_ikea.mkdir()
    publish_packs.publish(plain, source)
    _pack(source, "amluto.ikea-uk", name="IKEA UK range")
    publish_packs.publish(with_ikea, source)

    assert "IKEA" not in (plain / "NOTICE").read_text(encoding="utf-8")
    assert "IKEA" not in (plain / "README.md").read_text(encoding="utf-8")
    for name in ("NOTICE", "README.md"):
        text = " ".join((with_ikea / name).read_text(encoding="utf-8").split())
        assert "trademark of Inter IKEA Systems B.V." in text
        assert "not affiliated with, sponsored by or endorsed by IKEA" in text


def test_the_licence_at_the_top_is_the_packs_mit_licence(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    target.mkdir()

    publish_packs.publish(target, source)

    assert (target / "LICENSE").read_text(encoding="utf-8") == (source / "test.one" / "LICENSE").read_text(
        encoding="utf-8"
    )


def test_publishing_twice_changes_nothing(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    target.mkdir()

    publish_packs.publish(target, source)
    first = _tree(target)
    publish_packs.publish(target, source)

    assert _tree(target) == first


def test_the_real_bundled_packs_publish(tmp_path: Path) -> None:
    publish_packs.publish(tmp_path, BUNDLED)

    published = {p.name for p in tmp_path.iterdir() if (p / "pack.json").exists()}
    assert {"amluto.bedroom", "amluto.ikea-uk", "amluto.makers", "amluto.kitchen-bath"} <= published
    assert "amluto.core" not in published
    # the packs whose items name their parts (`role_names`, #411) are held back until older versions read it (#424)
    assert not {"amluto.living", "amluto.office", "amluto.devices"} & published
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "tree/main/amluto.bedroom" in readme
    assert "tree/main/amluto.ikea-uk" in readme
    assert "tree/main/amluto.makers" in readme
    assert "tree/main/amluto.living" not in readme
    assert "amluto-solutions/home-3d-packs" in readme


def test_a_pack_with_a_field_older_versions_refuse_is_held_back(tmp_path: Path) -> None:
    """`role_names` (#411) makes older Home 3D versions refuse the item, so an update to such a pack would fail there
    (#424): the pack stays out of the checkout and its README until they read it."""
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    named = _pack(source, "test.named")
    chair = {**CHAIR, "role_names": {"fabric": "cushion"}}
    (named / "seating" / "cube_chair.json").write_text(json.dumps(chair), encoding="utf-8")
    target.mkdir()

    assert publish_packs.publish(target, source) == ["test.one"]

    assert not (target / "test.named").exists()
    assert "test.named" not in (target / "README.md").read_text(encoding="utf-8")


def test_a_retired_pack_folder_is_replaced_by_a_readme_pointing_at_its_successors(tmp_path: Path) -> None:
    """A pack all of whose items moved away (#111) leaves the repository as a folder with only a README."""
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.new")
    old = _pack(target, "test.old")  # published earlier, now retired
    assert (old / "pack.json").exists()
    moves = tmp_path / "moved_items.json"
    moves.write_text(json.dumps({"moved": {"pack:test.old:cube_chair": "pack:test.new:cube_chair"}}), encoding="utf-8")

    publish_packs.publish(target, source, moves_file=moves)

    assert sorted(p.name for p in old.iterdir()) == ["README.md"]
    readme = (old / "README.md").read_text(encoding="utf-8")
    assert "tree/main/test.new" in readme
    assert "retired" in readme.lower()
    assert (target / "test.new" / "pack.json").exists()


# a stand-in for the packs repository's tools/build_index.py (#336): notes how it was run, or fails
_FAKE_INDEX_SCRIPT = """
import json, sys
from pathlib import Path
args = sys.argv[1:]
if (Path(args[1]) / "fail").exists():
    sys.exit("the index breaks these rules: test.one")
(Path(args[1]) / "index.json").write_text(json.dumps({"args": args}), encoding="utf-8")
"""


def test_publishing_builds_the_checkouts_pack_index_again(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    (target / "tools").mkdir(parents=True)
    (target / "tools" / "build_index.py").write_text(_FAKE_INDEX_SCRIPT, encoding="utf-8")

    publish_packs.publish(target, source)

    args = json.loads((target / "index.json").read_text(encoding="utf-8"))["args"]
    # built from the checkout, checked with this repository's pack check, community entries kept (no --fetch)
    assert args == ["build", str(target), "--home3d", str(ROOT)]
    assert "Get your pack listed" in (target / "README.md").read_text(encoding="utf-8")


def test_a_checkout_without_the_index_script_gets_no_index(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    target.mkdir()

    publish_packs.publish(target, source)

    assert not (target / "index.json").exists()


def test_an_index_that_fails_its_rules_stops_the_publish_with_its_reason(tmp_path: Path) -> None:
    source, target = tmp_path / "source", tmp_path / "packs"
    _pack(source, "test.one")
    (target / "tools").mkdir(parents=True)
    (target / "tools" / "build_index.py").write_text(_FAKE_INDEX_SCRIPT, encoding="utf-8")
    (target / "fail").write_text("", encoding="utf-8")

    with pytest.raises(publish_packs.PublishError, match=r"index\.json was not built"):
        publish_packs.publish(target, source)
